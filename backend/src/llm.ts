import Groq from "groq-sdk";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "../prompt";
import type { SearchResult } from "./search";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const LIGHT_MODEL = "llama-3.1-8b-instant";
const ANSWER_MODEL = LIGHT_MODEL;
const FOLLOWUP_MODEL = LIGHT_MODEL;

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

export function buildPrompt(
  query: string,
  results: SearchResult[],
  history: ConversationTurn[] = [],
  chatTitle?: string
): string {
  return PROMPT_TEMPLATE
    .replace("{{CHAT_TITLE}}", chatTitle?.trim() || "Untitled chat")
    .replace("{{CONVERSATION_HISTORY}}", JSON.stringify(history))
    .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(results))
    .replace("{{USER_QUERY}}", query);
}

export async function* streamAnswer(prompt: string): AsyncGenerator<string> {
  const stream = await groq.chat.completions.create({
    model: ANSWER_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: prompt },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export async function getFollowUps(query: string): Promise<string[]> {
  const res = await groq.chat.completions.create({
    model: FOLLOWUP_MODEL,
    messages: [
      {
        role: "user",
        content: `Generate exactly 3 concise follow-up questions for: "${query}". Reply with a JSON array of strings only — no markdown, no explanation.`,
      },
    ],
    stream: false,
  });

  const raw = (res.choices[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}
