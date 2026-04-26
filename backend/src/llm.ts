import Groq from "groq-sdk";
import { BASE_SYSTEM_PROMPT, DEFAULT_MODEL, SUPPORTED_MODELS } from "../prompt";
import type { SearchResult } from "./search";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AnswerOptions = {
  chatTitle?: string;
  conversationSummary?: string;
  systemPrompt?: string;
  memoryNotes?: string;
  outputFormat?: "bullets" | "paragraphs";
  responseLength?: "short" | "medium" | "long";
  roastLevel?: "light" | "medium" | "high";
  answerMode?: "fast" | "balanced" | "deep";
  onlyFromSources?: boolean;
  preferredModel?: string;
  useWebSearch?: boolean;
};

function sanitizeModel(model?: string) {
  if (!model) return DEFAULT_MODEL;
  return (SUPPORTED_MODELS as readonly string[]).includes(model) ? model : DEFAULT_MODEL;
}

function formatInstruction(outputFormat: AnswerOptions["outputFormat"]) {
  return outputFormat === "paragraphs"
    ? "Respond in short paragraphs."
    : "Respond in flat bullet points only. No nested bullets.";
}

function lengthInstruction(length: AnswerOptions["responseLength"]) {
  if (length === "long") return "Be thorough but still disciplined.";
  if (length === "medium") return "Keep a moderate level of detail.";
  return "Keep it tight and compact.";
}

function roastInstruction(level: AnswerOptions["roastLevel"]) {
  if (level === "high") return "Use sharp, sarcastic wit when the question, premise, or logic deserves it. Attack bad reasoning, not protected traits.";
  if (level === "light") return "Keep the tone mostly neutral with just a small edge.";
  return "Use a noticeable dry, sarcastic edge when it improves clarity.";
}

function modeInstruction(mode: AnswerOptions["answerMode"]) {
  if (mode === "deep") return "Bias toward careful synthesis and higher detail.";
  if (mode === "balanced") return "Balance speed and depth.";
  return "Optimize for speed and clarity.";
}

export function buildPrompt(
  query: string,
  results: SearchResult[],
  history: ConversationTurn[] = [],
  options: AnswerOptions = {}
): string {
  return [
    "## Answer configuration",
    formatInstruction(options.outputFormat ?? "bullets"),
    lengthInstruction(options.responseLength ?? "short"),
    roastInstruction(options.roastLevel ?? "medium"),
    modeInstruction(options.answerMode ?? "fast"),
    options.onlyFromSources
      ? "Only make factual claims that are supported by the provided sources. If the sources do not support the claim, say that directly."
      : "Use the provided sources when useful, but you may also reason carefully from conversation context.",
    "",
    "## Chat",
    `Title: ${options.chatTitle?.trim() || "Untitled chat"}`,
    options.conversationSummary?.trim()
      ? `Summary: ${options.conversationSummary.trim()}`
      : "Summary: None",
    options.systemPrompt?.trim()
      ? `Per-chat instructions: ${options.systemPrompt.trim()}`
      : "Per-chat instructions: None",
    options.memoryNotes?.trim()
      ? `User memory: ${options.memoryNotes.trim()}`
      : "User memory: None",
    "",
    "## Conversation history",
    JSON.stringify(history),
    "",
    "## Web search",
    options.useWebSearch === false ? "Disabled for this turn." : JSON.stringify(results),
    "",
    "## User query",
    query,
  ].join("\n");
}

export async function* streamAnswer(prompt: string, options: AnswerOptions = {}): AsyncGenerator<string> {
  const model = sanitizeModel(options.preferredModel);
  const stream = await groq.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: [
          BASE_SYSTEM_PROMPT,
          formatInstruction(options.outputFormat ?? "bullets"),
          lengthInstruction(options.responseLength ?? "short"),
          roastInstruction(options.roastLevel ?? "medium"),
          modeInstruction(options.answerMode ?? "fast"),
          options.onlyFromSources
            ? "Never invent support that is not in the cited source set."
            : "Reason carefully, but prefer grounded claims when sources are present.",
        ].join("\n"),
      },
      { role: "user", content: prompt },
    ],
    temperature: options.answerMode === "deep" ? 0.4 : 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export async function getFollowUps(
  query: string,
  answer: string,
  history: ConversationTurn[] = []
): Promise<string[]> {
  const res = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          "Generate exactly 3 concise, contextual follow-up questions.",
          "They should build on the conversation, not generic filler.",
          `Query: ${query}`,
          `Answer: ${answer.slice(0, 1200)}`,
          `History: ${JSON.stringify(history.slice(-6))}`,
          "Reply with a JSON array of strings only.",
        ].join("\n"),
      },
    ],
    stream: false,
  });

  const raw = (res.choices[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 3).filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
