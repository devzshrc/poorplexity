import { folderService } from "../services/folderService";
import type { RequestContext } from "../server/context";
import { pathMatch, requireUser } from "../server/context";
import { json, noContent } from "../server/responses";
import { folderCreateSchema, folderPatchSchema, readJson } from "../validation";

export async function handleFolderRoutes(ctx: RequestContext): Promise<Response | null> {
  if (ctx.pathname === "/api/folders" && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, folderCreateSchema);
    const folder = await folderService.createFolder(auth.userId, body.name?.trim() || "", body.parentFolderId);
    return json({ folder }, 201, ctx.headers);
  }

  const folderMatch = pathMatch(ctx.pathname, /^\/api\/folders\/([^/]+)$/);
  const folderId = folderMatch?.[1];
  if (folderId && ctx.req.method === "PATCH") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, folderPatchSchema);
    const folder = await folderService.renameFolder(auth.userId, folderId, body);
    return json({ folder }, 200, ctx.headers);
  }

  if (folderId && ctx.req.method === "DELETE") {
    const { auth } = await requireUser(ctx.req);
    await folderService.deleteFolder(auth.userId, folderId);
    return noContent(ctx.headers);
  }

  return null;
}
