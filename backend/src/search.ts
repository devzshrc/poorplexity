import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const res = await client.search(query, { searchDepth: "advanced" });
  return res.results as SearchResult[];
}
