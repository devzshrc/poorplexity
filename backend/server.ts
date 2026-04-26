const [{ authHandler, getSession }, { SSE_HEADERS, sseEvent }, { corsHeaders, getRequestOrigin, isAllowedOrigin, mergeHeaders }, { webSearch }, { buildPrompt, streamAnswer, getFollowUps }] =
  await Promise.all([
    import("./src/auth/middleware"),
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

const port = Number(process.env.PORT ?? "3598");

Bun.serve({
  port,

  routes: {
    "/api/auth/*": authHandler,

    "/auth/google/start": {
      GET: async (req) => {
        const url = new URL(req.url);
        const callbackURL = url.searchParams.get("callbackURL");
        const errorCallbackURL = url.searchParams.get("errorCallbackURL") ?? callbackURL;

        if (!callbackURL) {
          return json({ error: "callbackURL is required" }, 400);
        }

        const headers = new Headers(req.headers);
        headers.set("Content-Type", "application/json");

        const authURL = new URL("/api/auth/sign-in/social", req.url);
        const authReq = new Request(authURL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            provider: "google",
            callbackURL,
            errorCallbackURL,
          }),
        });

        return authHandler(authReq);
      },
    },

    "/conversation": {
      OPTIONS: (req) => {
        const origin = getRequestOrigin(req);
        const headers = corsHeaders(origin, { methods: ["POST", "OPTIONS"] });
        if (origin && !isAllowedOrigin(origin)) {
          return new Response(
            JSON.stringify({ error: "Origin not allowed" }),
            { status: 403, headers: mergeHeaders(headers, { "Content-Type": "application/json" }) }
          );
        }
        return new Response(null, { status: 204, headers });
      },

      POST: async (req) => {
        const origin = getRequestOrigin(req);
        const headers = corsHeaders(origin, { methods: ["POST", "OPTIONS"] });

        if (origin && !isAllowedOrigin(origin)) {
          return json({ error: "Origin not allowed" }, 403, headers);
        }

        const session = await getSession(req);
        if (!session) return json({ error: "Unauthorized" }, 401, headers);

        let query: string;
        try {
          const body = (await req.json()) as { query?: unknown };
          query = typeof body.query === "string" ? body.query.trim() : "";
        } catch {
          return json({ error: "Invalid request body" }, 400, headers);
        }

        if (!query) return json({ error: "query is required" }, 400, headers);
        if (query.length > 500) return json({ error: "query too long" }, 400, headers);

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

        return new Response(body, { headers: mergeHeaders(headers, SSE_HEADERS) });
      },
    },
  },
});

console.log(`Server running on http://localhost:${port}`);
