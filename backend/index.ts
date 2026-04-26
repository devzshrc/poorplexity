import { authHandler, getSession } from "./src/auth/middleware";
import { CORS_HEADERS, SSE_HEADERS, sseEvent } from "./src/sse";
import { webSearch } from "./src/search";
import { buildPrompt, streamAnswer, getFollowUps } from "./src/llm";

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
    // ── Auth (BetterAuth handles all /api/auth/* paths) ─────────────────────
    "/api/auth/*": authHandler,

    // ── Conversation (protected) ─────────────────────────────────────────────
    "/conversation": {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async (req) => {
        // ── Auth guard ──────────────────────────────────────────────────────
        const session = await getSession(req);
        if (!session) return json({ error: "Unauthorized" }, 401);

        // ── Input validation ────────────────────────────────────────────────
        let query: string;
        try {
          const body = (await req.json()) as { query?: unknown };
          query = typeof body.query === "string" ? body.query.trim() : "";
        } catch {
          return json({ error: "Invalid request body" }, 400);
        }
        if (!query) return json({ error: "query is required" }, 400);
        if (query.length > 500) return json({ error: "query too long" }, 400);

        // ── Stream ──────────────────────────────────────────────────────────
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
