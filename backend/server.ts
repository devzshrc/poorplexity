import { logger } from "./src/logger";
import { applyCorsGuard, handleOptions } from "./src/middleware/cors";
import { routeRequest } from "./src/routes";
import { createRequestContext } from "./src/server/context";
import { json, toPublicError } from "./src/server/responses";

const port = Number(process.env.PORT ?? "3598");

Bun.serve({
  port,

  async fetch(req) {
    const ctx = createRequestContext(req);

    const corsResponse = applyCorsGuard(ctx);
    if (corsResponse) return corsResponse;

    const optionsResponse = handleOptions(ctx);
    if (optionsResponse) return optionsResponse;

    try {
      return await routeRequest(ctx);
    } catch (error) {
      const publicError = toPublicError(error);
      logger.error("request failed", {
        requestId: ctx.id,
        method: req.method,
        pathname: ctx.pathname,
        status: publicError.status,
        durationMs: Math.round(performance.now() - ctx.startedAt),
        error: error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
      });

      return json({
        error: publicError.message,
        code: publicError.code,
        ...(publicError.details !== undefined ? { details: publicError.details } : {}),
      }, publicError.status, ctx.headers);
    }
  },
});

logger.info("server started", { url: `http://localhost:${port}` });
