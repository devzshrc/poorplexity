const [
  { authenticateRequest, getClerkUser },
  {
    appendMessage,
    createChat,
    createFolder,
    deleteChat,
    deleteFolder,
    deleteStoredUserData,
    getDailyUserMessageCount,
    getChatContext,
    getChatDetail,
    getWorkspace,
    renameFolder,
    syncUser,
    updateUserProfile,
    updateChat,
  },
  { SSE_HEADERS, sseEvent },
  { corsHeaders, getRequestOrigin, isAllowedOrigin, mergeHeaders },
  { webSearch },
  { buildPrompt, streamAnswer, getFollowUps },
] = await Promise.all([
  import("./src/auth"),
  import("./src/mongo"),
  import("./src/sse"),
  import("./src/http"),
  import("./src/search"),
  import("./src/llm"),
]);

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: mergeHeaders(new Headers(headers), { "Content-Type": "application/json" }),
  });
}

function pathMatch(pathname: string, pattern: RegExp) {
  return pathname.match(pattern);
}

async function readJson<T>(req: Request): Promise<T> {
  return await req.json() as T;
}

async function requireUser(req: Request) {
  const auth = await authenticateRequest(req);
  const clerkUser = await getClerkUser(auth.userId);
  const userProfile = await syncUser(clerkUser);
  return {
    auth,
    clerkUser,
    userProfile,
    displayName:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
      || clerkUser.primaryEmailAddress?.emailAddress
      || clerkUser.username
      || clerkUser.id,
  };
}

const port = Number(process.env.PORT ?? "3598");

Bun.serve({
  port,

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const origin = getRequestOrigin(req);
    const headers = corsHeaders(origin, {
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    });

    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: "Origin not allowed" }, 403, headers);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      if (pathname === "/api/workspace" && req.method === "GET") {
        const { auth, userProfile } = await requireUser(req);
        const workspace = await getWorkspace(auth.userId);
        return json(
          {
            user: userProfile,
            ...workspace,
          },
          200,
          headers
        );
      }

      if (pathname === "/api/settings/profile" && req.method === "PATCH") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ displayName?: string; imageUrl?: string; bio?: string }>(req);
        const user = await updateUserProfile(auth.userId, {
          displayName: body.displayName,
          imageUrl: body.imageUrl,
          bio: body.bio,
        });
        return json({ user }, 200, headers);
      }

      if (pathname === "/api/settings/data" && req.method === "DELETE") {
        const { auth } = await requireUser(req);
        await deleteStoredUserData(auth.userId);
        return new Response(null, { status: 204, headers });
      }

      if (pathname === "/api/folders" && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ name?: string }>(req);
        const folder = await createFolder(auth.userId, body.name?.trim() || "");
        return json({ folder }, 201, headers);
      }

      const folderMatch = pathMatch(pathname, /^\/api\/folders\/([^/]+)$/);
      const folderId = folderMatch?.[1];
      if (folderId && req.method === "PATCH") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ name?: string }>(req);
        const folder = await renameFolder(auth.userId, folderId, body.name?.trim() || "");
        return json({ folder }, 200, headers);
      }

      if (folderId && req.method === "DELETE") {
        const { auth } = await requireUser(req);
        await deleteFolder(auth.userId, folderId);
        return new Response(null, { status: 204, headers });
      }

      if (pathname === "/api/chats" && req.method === "POST") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ title?: string; folderId?: string | null; firstMessage?: string }>(req);
        const chat = await createChat({
          clerkUserId: auth.userId,
          title: body.title,
          folderId: body.folderId,
          firstMessage: body.firstMessage,
        });
        return json({ chat }, 201, headers);
      }

      const chatMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)$/);
      const chatIdFromPath = chatMatch?.[1];
      if (chatIdFromPath && req.method === "GET") {
        const { auth } = await requireUser(req);
        const chat = await getChatDetail(auth.userId, chatIdFromPath);
        return json({ chat }, 200, headers);
      }

      if (chatIdFromPath && req.method === "PATCH") {
        const { auth } = await requireUser(req);
        const body = await readJson<{ title?: string; folderId?: string | null }>(req);
        const chat = await updateChat(auth.userId, chatIdFromPath, body);
        return json({ chat }, 200, headers);
      }

      if (chatIdFromPath && req.method === "DELETE") {
        const { auth } = await requireUser(req);
        await deleteChat(auth.userId, chatIdFromPath);
        return new Response(null, { status: 204, headers });
      }

      const messageMatch = pathMatch(pathname, /^\/api\/chats\/([^/]+)\/messages$/);
      const messageChatId = messageMatch?.[1];
      if (messageChatId && req.method === "POST") {
        const { auth } = await requireUser(req);
        const chatId = messageChatId;
        const body = await readJson<{ content?: string }>(req);
        const content = body.content?.trim() || "";

        if (!content) {
          return json({ error: "content is required" }, 400, headers);
        }

        if (content.length > 4000) {
          return json({ error: "content too long" }, 400, headers);
        }

        const dailyMessageCount = await getDailyUserMessageCount(auth.userId);
        if (dailyMessageCount >= 2) {
          return json(
            { error: "Daily message limit reached. You can send up to 2 messages per day." },
            429,
            headers
          );
        }

        await appendMessage({
          clerkUserId: auth.userId,
          chatId,
          role: "user",
          content,
        });

        const context = await getChatContext(auth.userId, chatId, 12);
        const history = context.messages.slice(0, -1);

        const bodyStream = new ReadableStream({
          async start(controller) {
            try {
              const results = await webSearch(content);
              controller.enqueue(sseEvent("sources", results));

              const followUpsPromise = getFollowUps(content).catch(() => []);
              let assistantText = "";

              for await (const chunk of streamAnswer(
                buildPrompt(content, results, history, context.title)
              )) {
                assistantText += chunk;
                controller.enqueue(sseEvent("answer", chunk));
              }

              const followUps = await followUpsPromise;
              const persisted = await appendMessage({
                clerkUserId: auth.userId,
                chatId,
                role: "assistant",
                content: assistantText.trim(),
                sources: results,
                followUps,
              });

              controller.enqueue(sseEvent("followUps", followUps));
              controller.enqueue(sseEvent("chat", persisted.summary));
              controller.enqueue(sseEvent("done", { chatId }));
            } catch (error) {
              controller.enqueue(
                sseEvent("error", {
                  message: error instanceof Error ? error.message : String(error),
                })
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(bodyStream, {
          headers: mergeHeaders(headers, SSE_HEADERS),
        });
      }

      return json({ error: "Not found" }, 404, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /Unauthorized/i.test(message)
        ? 401
        : /not found/i.test(message)
          ? 404
          : /limit/i.test(message)
            ? 429
            : 400;
      return json({ error: message }, status, headers);
    }
  },
});

console.log(`Server running on http://localhost:${port}`);
