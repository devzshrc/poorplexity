const isRenderBuild = process.env.RENDER === "true" && !process.env.PORT;

if (isRenderBuild) {
  console.log("Render build detected without PORT; skipping server startup.");
  process.exit(0);
}

const [{ authHandler, getSession }, { CORS_HEADERS, SSE_HEADERS, sseEvent }, { webSearch }, { buildPrompt, streamAnswer, getFollowUps }] =
  await Promise.all([
    import("./src/auth/middleware"),
    import("./src/sse"),
    import("./src/search"),
    import("./src/llm"),
  ]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const port = Number(process.env.PORT ?? "3598");

Bun.serve({
  port,

  routes: {
    // Auth (BetterAuth handles all /api/auth/* paths)
    "/api/auth/*": authHandler,

    // Conversation (protected)
    "/conversation": {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async (req) => {
        const session = await getSession(req);
        if (!session) return json({ error: "Unauthorized" }, 401);

        let query: string;
        try {
          const body = (await req.json()) as { query?: unknown };
          query = typeof body.query === "string" ? body.query.trim() : "";
        } catch {
          return json({ error: "Invalid request body" }, 400);
        }

        if (!query) return json({ error: "query is required" }, 400);
        if (query.length > 500) return json({ error: "query too long" }, 400);

        const body = new ReadableStream({
          async start(controller) {
            try {
              const results = await webSearch(query);
              controller.enqueue(sseEvent("sources", results));

              const followUpsPromise = getFollowUps(query).catch(() => []);

              for await (const chunk of streamAnswer(buildPrompt(query, results))) {
                controller.enqueue(sseEvent("answer", chunk));
              }

              controller.enqueue(sseEvent("followUps", await followUpsPromise));
              controller.enqueue(sseEvent("done", {}));
            } catch (e) {
              controller.enqueue(
                sseEvent("error", { message: e instanceof Error ? e.message : String(e) })
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(body, { headers: SSE_HEADERS });
      },
    },
  },
});

console.log(`Server running on http://localhost:${port}`);
