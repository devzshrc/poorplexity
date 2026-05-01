import { tavily } from "@tavily/core";
import { withRetry, withTimeout } from "./resilience";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
const SEARCH_TIMEOUT_MS = 12_000;

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const res = await withRetry(
    () => withTimeout(
      () => client.search(query, { searchDepth: "advanced" }),
      SEARCH_TIMEOUT_MS,
      "Web search timed out"
    ),
    { attempts: 2, baseDelayMs: 250 }
  );
  return res.results as SearchResult[];
}
