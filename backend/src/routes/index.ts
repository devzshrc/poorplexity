import type { RequestContext } from "../server/context";
import { json } from "../server/responses";
import { handleBillingRoutes } from "../controllers/billingController";
import { handleChatRoutes } from "../controllers/chatController";
import { handleFolderRoutes } from "../controllers/folderController";
import { handleHealthRoute } from "../controllers/healthController";
import { handleWebhookRoutes } from "../controllers/webhookController";
import { handleWorkspaceRoutes } from "../controllers/workspaceController";

const routeHandlers = [
  handleHealthRoute,
  handleWebhookRoutes,
  handleWorkspaceRoutes,
  handleBillingRoutes,
  handleFolderRoutes,
  handleChatRoutes,
];

export async function routeRequest(ctx: RequestContext): Promise<Response> {
  for (const handler of routeHandlers) {
    const response = await handler(ctx);
    if (response) return response;
  }

  return json({ error: "Not found" }, 404, ctx.headers);
}
