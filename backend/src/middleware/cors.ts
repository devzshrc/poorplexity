import type { RequestContext } from "../server/context";
import { isOriginAllowed } from "../server/context";
import { originForbidden } from "../server/responses";

export function applyCorsGuard(ctx: RequestContext): Response | null {
  return isOriginAllowed(ctx) ? null : originForbidden(ctx.headers);
}

export function handleOptions(ctx: RequestContext): Response | null {
  return ctx.req.method === "OPTIONS"
    ? new Response(null, { status: 204, headers: ctx.headers })
    : null;
}
