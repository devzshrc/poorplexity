import { billingService } from "../services/billingService";
import type { RequestContext } from "../server/context";
import { requireUser } from "../server/context";
import { json } from "../server/responses";
import { billingVerifySchema, readJson, subscribeCancelSchema } from "../validation";

export async function handleBillingRoutes(ctx: RequestContext): Promise<Response | null> {
  if (ctx.pathname === "/api/billing" && ctx.req.method === "GET") {
    const { auth } = await requireUser(ctx.req);
    return json({
      billing: await billingService.getBillingSummary(auth.userId),
      limits: await billingService.getMessageEntitlement(auth.userId),
    }, 200, ctx.headers);
  }

  if (ctx.pathname === "/api/billing/subscribe" && ctx.req.method === "POST") {
    const { auth, userProfile } = await requireUser(ctx.req);
    if (!billingService.billingEnabled()) {
      return json({ error: "Billing is not configured" }, 503, ctx.headers);
    }

    const entitlement = await billingService.getMessageEntitlement(auth.userId);
    if (entitlement.billing?.isPremium) {
      return json({ error: "An active premium subscription already exists", billing: entitlement.billing }, 409, ctx.headers);
    }

    if (
      entitlement.billing?.razorpaySubscriptionId
      && entitlement.billing.status !== "cancelled"
      && entitlement.billing.status !== "completed"
      && entitlement.billing.status !== "expired"
    ) {
      const existing = await billingService.fetchSubscription(entitlement.billing.razorpaySubscriptionId).catch(() => null);
      if (existing && !["cancelled", "completed", "expired"].includes(existing.status)) {
        await billingService.applySubscriptionSnapshot({
          clerkUserId: auth.userId,
          subscription: existing,
          planName: entitlement.billing.planName,
          amountPaise: entitlement.billing.amountPaise,
          currency: entitlement.billing.currency,
          lastPaymentId: entitlement.billing.lastPaymentId,
          failureReason: entitlement.billing.failureReason,
        });

        return json({
          checkout: {
            key: process.env.RAZORPAY_KEY_ID,
            subscriptionId: existing.id,
            name: entitlement.billing.planName ?? "poorplexity Premium",
            description: "Premium subscription with a higher daily message allowance",
            amountPaise: entitlement.billing.amountPaise,
            currency: entitlement.billing.currency,
            prefill: {
              name: userProfile.displayName,
              email: userProfile.email,
            },
            theme: { color: "#e67e22" },
          },
          billing: await billingService.getBillingSummary(auth.userId),
        }, 200, ctx.headers);
      }
    }

    const created = await billingService.createPremiumSubscription({
      clerkUserId: auth.userId,
      email: userProfile.email,
      displayName: userProfile.displayName,
    });

    await billingService.markSubscriptionCheckoutPending({
      clerkUserId: auth.userId,
      subscription: created.subscription,
      planName: created.planName,
      amountPaise: created.amount,
      currency: created.currency,
    });

    return json({
      checkout: {
        key: created.checkoutKey,
        subscriptionId: created.subscription.id,
        name: created.planName,
        description: created.description,
        amountPaise: created.amount,
        currency: created.currency,
        prefill: {
          name: userProfile.displayName,
          email: userProfile.email,
        },
        theme: { color: "#e67e22" },
      },
          billing: await billingService.getBillingSummary(auth.userId),
    }, 200, ctx.headers);
  }

  if (ctx.pathname === "/api/billing/verify" && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    if (!billingService.billingEnabled()) {
      return json({ error: "Billing is not configured" }, 503, ctx.headers);
    }

    const body = await readJson(ctx.req, billingVerifySchema);
    const paymentId = body.razorpay_payment_id?.trim() || "";
    const clientSubscriptionId = body.razorpay_subscription_id?.trim() || "";
    const signature = body.razorpay_signature?.trim() || "";

    if (!paymentId || !clientSubscriptionId || !signature) {
      return json({ error: "Missing payment verification fields" }, 400, ctx.headers);
    }

    const billing = await billingService.getBillingSummary(auth.userId);
    const expectedSubscriptionId = billing.razorpaySubscriptionId;
    if (!expectedSubscriptionId || expectedSubscriptionId !== clientSubscriptionId) {
      return json({ error: "Subscription verification mismatch" }, 400, ctx.headers);
    }

    const verified = billingService.verifySubscriptionPaymentSignature({
      subscriptionId: expectedSubscriptionId,
      paymentId,
      signature,
    });
    if (!verified) {
      return json({ error: "Invalid payment signature" }, 401, ctx.headers);
    }

    const snapshot = await billingService.fetchSubscription(expectedSubscriptionId);
    const nextBilling = await billingService.applySubscriptionSnapshot({
      clerkUserId: auth.userId,
      subscription: snapshot,
      planName: billing.planName,
      amountPaise: billing.amountPaise,
      currency: billing.currency,
      lastPaymentId: paymentId,
      failureReason: null,
    });

    return json({ billing: nextBilling }, 200, ctx.headers);
  }

  if (ctx.pathname === "/api/billing/cancel" && ctx.req.method === "POST") {
    const { auth } = await requireUser(ctx.req);
    if (!billingService.billingEnabled()) {
      return json({ error: "Billing is not configured" }, 503, ctx.headers);
    }

    const body = await readJson(ctx.req, subscribeCancelSchema).catch(() => ({ cancelAtCycleEnd: undefined }));
    const billing = await billingService.getBillingSummary(auth.userId);
    if (!billing.razorpaySubscriptionId) {
      return json({ error: "No active subscription found" }, 404, ctx.headers);
    }

    const snapshot = await billingService.cancelSubscription(
      billing.razorpaySubscriptionId,
      body.cancelAtCycleEnd !== false
    );
    const nextBilling = await billingService.applySubscriptionSnapshot({
      clerkUserId: auth.userId,
      subscription: snapshot,
      planName: billing.planName,
      amountPaise: billing.amountPaise,
      currency: billing.currency,
      lastPaymentId: billing.lastPaymentId,
      failureReason: billing.failureReason,
    });

    return json({ billing: nextBilling }, 200, ctx.headers);
  }

  return null;
}
