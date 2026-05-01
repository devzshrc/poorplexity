import { authenticateRequest, getClerkUser } from "../auth";
import { corsHeaders, getRequestOrigin, isAllowedOrigin } from "../http";
import { requestId } from "../logger";
import { userService } from "../services/userService";

export type RequestContext = {
  id: string;
  startedAt: number;
  req: Request;
  url: URL;
  pathname: string;
  origin: string | null;
  headers: Headers;
};

export function createRequestContext(req: Request): RequestContext {
  const url = new URL(req.url);
  const origin = getRequestOrigin(req);
  const headers = corsHeaders(origin, {
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  headers.set("X-Request-Id", requestId());

  return {
    id: headers.get("X-Request-Id") ?? crypto.randomUUID(),
    startedAt: performance.now(),
    req,
    url,
    pathname: url.pathname,
    origin,
    headers,
  };
}

export function isOriginAllowed(ctx: RequestContext) {
  return !ctx.origin || isAllowedOrigin(ctx.origin);
}

export async function requireUser(req: Request) {
  const auth = await authenticateRequest(req);
  const clerkUser = await getClerkUser(auth.userId);
  const userProfile = await userService.syncUser(clerkUser);
  return { auth, clerkUser, userProfile };
}

export function pathMatch(pathname: string, pattern: RegExp) {
  return pathname.match(pattern);
}
