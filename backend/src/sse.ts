const encoder = new TextEncoder();

export function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Credentials-aware CORS — wildcard origin is forbidden when credentials: include is used
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
} as const;

export const SSE_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
} as const;
