import { mergeHeaders } from "../http";
import type { RequestContext } from "../server/context";
import { text } from "../server/responses";

export async function handleHealthRoute(ctx: RequestContext): Promise<Response | null> {
  if ((ctx.pathname === "/health" || ctx.pathname === "/api/health") && (ctx.req.method === "GET" || ctx.req.method === "HEAD")) {
    return text(ctx.req.method === "HEAD" ? null : "OK", 200, mergeHeaders(new Headers(ctx.headers), { "Content-Type": "text/plain; charset=utf-8" }));
  }
  return null;
}
