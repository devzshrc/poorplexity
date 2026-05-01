import { billingService } from "../services/billingService";
import type { RequestContext } from "../server/context";
import { json, noContent } from "../server/responses";

export async function handleWebhookRoutes(ctx: RequestContext): Promise<Response | null> {
  if (ctx.pathname !== "/api/webhooks/razorpay" || ctx.req.method !== "POST") return null;

  if (!billingService.billingEnabled()) {
    return json({ error: "Billing is not configured" }, 503, ctx.headers);
  }

  const signature = ctx.req.headers.get("x-razorpay-signature")?.trim();
  const eventId = ctx.req.headers.get("x-razorpay-event-id")?.trim();
  if (!signature || !eventId) {
    return json({ error: "Missing Razorpay webhook headers" }, 400, ctx.headers);
  }

  const rawBody = await ctx.req.text();
  if (!billingService.verifyWebhookSignature(rawBody, signature)) {
    return json({ error: "Invalid webhook signature" }, 401, ctx.headers);
  }

  const event = billingService.parseWebhookEvent(rawBody);
  const extracted = billingService.extractSubscriptionFromWebhook(event);
  const subscriptionId = extracted.subscription?.id ?? null;
  const notedClerkUserId = extracted.subscription?.notes?.clerk_user_id ?? null;

  const duplicate = await billingService.recordBillingWebhookEvent({
    eventId,
    eventType: event.event,
    razorpaySubscriptionId: subscriptionId,
    clerkUserId: notedClerkUserId,
  });
  if (duplicate.duplicate) return noContent(ctx.headers, 200);

  if (subscriptionId) {
    const linkedUser = await billingService.findBillingUserBySubscriptionId(subscriptionId);
    const clerkUserId = linkedUser?.clerkUserId ?? notedClerkUserId ?? null;

    if (clerkUserId) {
      await billingService.attachBillingWebhookEventUser(eventId, clerkUserId);
      const snapshot = await billingService.fetchSubscription(subscriptionId).catch(() => extracted.subscription);
      if (snapshot) {
        await billingService.applySubscriptionSnapshot({
          clerkUserId,
          subscription: snapshot,
          planName: linkedUser?.billing.planName ?? null,
          amountPaise: linkedUser?.billing.amountPaise ?? null,
          currency: linkedUser?.billing.currency ?? null,
          lastPaymentId: extracted.paymentId,
          failureReason: extracted.paymentFailureReason,
          webhookEventId: eventId,
          webhookReceivedAt: new Date(),
        });
      }
    }
  }

  return noContent(ctx.headers, 200);
}
