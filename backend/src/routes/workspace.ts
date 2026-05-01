import { userService } from "../services/userService";
import type { RequestContext } from "../server/context";
import { pathMatch, requireUser } from "../server/context";
import { json, noContent } from "../server/responses";
import {
  preferencesPatchSchema,
  profilePatchSchema,
  readJson,
} from "../validation";

export async function handleWorkspaceRoutes(ctx: RequestContext): Promise<Response | null> {
  if (ctx.pathname === "/api/workspace" && ctx.req.method === "GET") {
    const { auth, userProfile } = await requireUser(ctx.req);
    const workspace = await userService.getWorkspace(auth.userId);
    return json({
      user: userProfile,
      folders: workspace.folders,
      chats: workspace.chats,
      trash: workspace.trash,
      usage: workspace.usage,
    }, 200, ctx.headers);
  }

  const publicProfileMatch = pathMatch(ctx.pathname, /^\/api\/public-profile\/([^/]+)$/);
  if (publicProfileMatch?.[1] && ctx.req.method === "GET") {
    return json(await userService.getPublicProfile(publicProfileMatch[1]), 200, ctx.headers);
  }

  if (ctx.pathname === "/api/settings/profile" && ctx.req.method === "PATCH") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, profilePatchSchema);
    const user = await userService.updateUserProfile(auth.userId, body);
    return json({ user }, 200, ctx.headers);
  }

  if (ctx.pathname === "/api/settings/preferences" && ctx.req.method === "PATCH") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, preferencesPatchSchema);
    const user = await userService.updateUserPreferences(auth.userId, body);
    return json({ user }, 200, ctx.headers);
  }

  if (ctx.pathname === "/api/settings/export" && ctx.req.method === "GET") {
    const { auth } = await requireUser(ctx.req);
    return json(await userService.exportUserData(auth.userId), 200, ctx.headers);
  }

  if (ctx.pathname === "/api/settings/usage" && ctx.req.method === "GET") {
    const { auth } = await requireUser(ctx.req);
    return json(await userService.getUsageDashboard(auth.userId), 200, ctx.headers);
  }

  if (ctx.pathname === "/api/settings/data" && ctx.req.method === "DELETE") {
    const { auth } = await requireUser(ctx.req);
    await userService.deleteStoredUserData(auth.userId);
    return noContent(ctx.headers);
  }

  if (ctx.pathname === "/api/search" && ctx.req.method === "GET") {
    const { auth } = await requireUser(ctx.req);
    const query = ctx.url.searchParams.get("q")?.trim() || "";
    if (query.length > 200) {
      return json({ error: "Search query is too long" }, 400, ctx.headers);
    }
    return json(await userService.searchWorkspace(auth.userId, query), 200, ctx.headers);
  }

  return null;
}
