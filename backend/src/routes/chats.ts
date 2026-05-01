import { streamAssistantReply } from "../assistant";
import { chatService } from "../services/chatService";
import type { RequestContext } from "../server/context";
import { pathMatch, requireUser } from "../server/context";
import { json, noContent } from "../server/responses";
import {
  archiveSchema,
  branchSchema,
  chatCreateSchema,
  chatPatchSchema,
  editMessageSchema,
  messageCreateSchema,
  pinSchema,
  readJson,
} from "../validation";

export async function handleChatRoutes(ctx: RequestContext): Promise<Response | null> {
  if (ctx.pathname === "/api/chats" && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, chatCreateSchema);
    const chat = await chatService.createChat({
      clerkUserId: auth.userId,
      title: body.title,
      folderId: body.folderId,
      firstMessage: body.firstMessage,
      branchFromChatId: body.branchFromChatId,
      branchFromMessageId: body.branchFromMessageId,
    });
    return json({ chat }, 201, ctx.headers);
  }

  const archiveMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)\/archive$/);
  if (archiveMatch?.[1] && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, archiveSchema);
    const chat = await chatService.archiveChat(auth.userId, archiveMatch[1], body.isArchived ?? true);
    return json({ chat }, 200, ctx.headers);
  }

  const pinMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)\/pin$/);
  if (pinMatch?.[1] && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, pinSchema);
    const chat = await chatService.pinChat(auth.userId, pinMatch[1], body.isPinned ?? true);
    return json({ chat }, 200, ctx.headers);
  }

  const restoreMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)\/restore$/);
  if (restoreMatch?.[1] && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const chat = await chatService.restoreChat(auth.userId, restoreMatch[1]);
    return json({ chat }, 200, ctx.headers);
  }

  const branchMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)\/branch$/);
  if (branchMatch?.[1] && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, branchSchema);
    const chat = await chatService.branchChat(auth.userId, branchMatch[1], body.messageId);
    return json({ chat }, 201, ctx.headers);
  }

  const editMessageMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)\/edit-message$/);
  if (editMessageMatch?.[1] && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, editMessageSchema);
    const content = body.content?.trim() || "";
    if (!body.messageId || !content) {
      return json({ error: "messageId and content are required" }, 400, ctx.headers);
    }
    if (content.length > 4000) {
      return json({ error: "content too long" }, 400, ctx.headers);
    }

    const chat = await chatService.rewriteChatFromMessage(auth.userId, editMessageMatch[1], body.messageId, content);
    return json({ chat }, 200, ctx.headers);
  }

  const regenerateMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)\/regenerate$/);
  if (regenerateMatch?.[1] && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const detail = await chatService.getChatDetail(auth.userId, regenerateMatch[1]);
    const lastUser = [...detail.messages].reverse().find((message) => message.role === "user");
    if (!lastUser) {
      return json({ error: "No user message to regenerate from" }, 400, ctx.headers);
    }
    await chatService.rewriteChatFromMessage(auth.userId, regenerateMatch[1], lastUser.id);
    return await streamAssistantReply({
      clerkUserId: auth.userId,
      chatId: regenerateMatch[1],
      query: lastUser.content,
      headers: new Headers(ctx.headers),
    });
  }

  const messageMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)\/messages$/);
  const messageChatId = messageMatch?.[1];
  if (messageChatId && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, messageCreateSchema);
    const content = body.content?.trim() || "";

    if (!content) return json({ error: "content is required" }, 400, ctx.headers);
    if (content.length > 4000) return json({ error: "content too long" }, 400, ctx.headers);

    const entitlement = await chatService.getMessageEntitlement(auth.userId);
    if (entitlement.dailyLimit !== null && entitlement.sentToday >= entitlement.dailyLimit) {
      return json({
        error: "Daily message limit reached.",
        code: "DAILY_LIMIT_REACHED",
        billing: entitlement.billing,
        sentToday: entitlement.sentToday,
        dailyLimit: entitlement.dailyLimit,
        remainingToday: entitlement.remainingToday,
      }, 429, ctx.headers);
    }

    await chatService.appendMessage({
      clerkUserId: auth.userId,
      chatId: messageChatId,
      role: "user",
      content,
    });

    return await streamAssistantReply({
      clerkUserId: auth.userId,
      chatId: messageChatId,
      query: content,
      headers: new Headers(ctx.headers),
      overrideWebSearch: body.useWebSearch,
    });
  }

  const chatMatch = pathMatch(ctx.pathname, /^\/api\/chats\/([^/]+)$/);
  const chatIdFromPath = chatMatch?.[1];
  if (chatIdFromPath && ctx.req.method === "GET") {
    const { auth } = await requireUser(ctx.req);
    const chat = await chatService.getChatDetail(auth.userId, chatIdFromPath);
    return json({ chat }, 200, ctx.headers);
  }

  if (chatIdFromPath && ctx.req.method === "PATCH") {
    const { auth } = await requireUser(ctx.req);
    const body = await readJson(ctx.req, chatPatchSchema);
    const chat = await chatService.updateChat(auth.userId, chatIdFromPath, body);
    return json({ chat }, 200, ctx.headers);
  }

  if (chatIdFromPath && ctx.req.method === "DELETE") {
    const { auth } = await requireUser(ctx.req);
    await chatService.softDeleteChat(auth.userId, chatIdFromPath);
    return noContent(ctx.headers);
  }

  return null;
}
