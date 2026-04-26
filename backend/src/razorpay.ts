import { createHmac, timingSafeEqual } from "node:crypto";

type RazorpayPlan = {
  id: string;
  period?: string;
  interval?: number;
  item?: {
    name?: string;
    description?: string;
    amount?: number;
    currency?: string;
  };
};

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  customer_id?: string | null;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired";
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  auth_attempts?: number | null;
  total_count?: number | null;
  paid_count?: number | null;
  customer_notify?: boolean;
  created_at?: number | null;
  expire_by?: number | null;
  short_url?: string | null;
  has_scheduled_changes?: boolean;
  change_scheduled_at?: number | string | null;
  remaining_count?: number | null;
  notes?: Record<string, string>;
};

type RazorpayWebhookEvent = {
  event: string;
  created_at?: number;
  payload?: {
    subscription?: { entity?: RazorpaySubscription };
    payment?: { entity?: { id?: string | null; error_description?: string | null; error_reason?: string | null } };
  };
};

function optionalEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function requiredEnv(name: string) {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getNumberEnv(name: string, fallback: number) {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric environment variable: ${name}`);
  return parsed;
}

function getBooleanEnv(name: string, fallback: boolean) {
  const raw = optionalEnv(name).toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  throw new Error(`Invalid boolean environment variable: ${name}`);
}

export function billingEnabled() {
  return Boolean(optionalEnv("RAZORPAY_KEY_ID") && optionalEnv("RAZORPAY_KEY_SECRET"));
}

function getApiCredentials() {
  return {
    keyId: requiredEnv("RAZORPAY_KEY_ID"),
    keySecret: requiredEnv("RAZORPAY_KEY_SECRET"),
  };
}

function getWebhookSecrets() {
  return [optionalEnv("RAZORPAY_WEBHOOK_SECRET"), optionalEnv("RAZORPAY_WEBHOOK_SECRET_OLD")].filter(Boolean);
}

function getAuthHeader() {
  const { keyId, keySecret } = getApiCredentials();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function getBaseUrl() {
  return "https://api.razorpay.com/v1";
}

function normalizeApiError(payload: any, fallbackStatus: number) {
  const message = payload?.error?.description
    || payload?.error?.reason
    || payload?.error?.field
    || payload?.error?.code
    || payload?.description
    || `Razorpay API request failed (${fallbackStatus})`;
  return new Error(String(message));
}

async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!billingEnabled()) {
    throw new Error("Billing is not configured");
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw normalizeApiError(payload, response.status);
  }
  return payload as T;
}

function getPremiumPlanConfig() {
  return {
    amount: getNumberEnv("RAZORPAY_PREMIUM_AMOUNT", 10000),
    currency: optionalEnv("RAZORPAY_PREMIUM_CURRENCY") || "INR",
    interval: getNumberEnv("RAZORPAY_PREMIUM_INTERVAL", 1),
    period: (optionalEnv("RAZORPAY_PREMIUM_PERIOD") || "monthly").toLowerCase(),
    totalCount: getNumberEnv("RAZORPAY_PREMIUM_TOTAL_COUNT", 120),
    customerNotify: getBooleanEnv("RAZORPAY_PREMIUM_CUSTOMER_NOTIFY", true),
    name: optionalEnv("RAZORPAY_PREMIUM_NAME") || "poorplexity Premium",
    description: optionalEnv("RAZORPAY_PREMIUM_DESCRIPTION") || "Premium subscription with a higher daily message allowance",
    lookupName: optionalEnv("RAZORPAY_PREMIUM_LOOKUP_NAME") || "poorplexity-premium-monthly",
  };
}

async function findReusablePlanId() {
  const config = getPremiumPlanConfig();
  const response = await razorpayRequest<{ items?: RazorpayPlan[] }>("/plans?count=100&skip=0", {
    method: "GET",
  });

  const match = response.items?.find((plan) =>
    plan.period?.toLowerCase() === config.period
    && Number(plan.interval) === config.interval
    && Number(plan.item?.amount) === config.amount
    && String(plan.item?.currency || "").toUpperCase() === config.currency.toUpperCase()
    && String(plan.item?.name || "").trim() === config.name
  );

  return match?.id ?? null;
}

export async function ensurePremiumPlanId() {
  const configured = optionalEnv("RAZORPAY_PREMIUM_PLAN_ID");
  if (configured) return configured;

  const existing = await findReusablePlanId();
  if (existing) return existing;

  const config = getPremiumPlanConfig();
  const created = await razorpayRequest<RazorpayPlan>("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: config.period,
      interval: config.interval,
      item: {
        name: config.name,
        description: config.description,
        amount: config.amount,
        currency: config.currency,
      },
      notes: {
        internal_plan_key: config.lookupName,
      },
    }),
  });

  if (!created.id) throw new Error("Unable to provision Razorpay plan");
  return created.id;
}

export async function createPremiumSubscription(params: {
  clerkUserId: string;
  email?: string | null;
  displayName?: string | null;
}) {
  const config = getPremiumPlanConfig();
  const planId = await ensurePremiumPlanId();
  const expireBy = Math.floor(Date.now() / 1000) + 60 * 30;

  const subscription = await razorpayRequest<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: config.totalCount,
      quantity: 1,
      customer_notify: config.customerNotify ? 1 : 0,
      expire_by: expireBy,
      notes: {
        clerk_user_id: params.clerkUserId,
        email: params.email ?? "",
        display_name: params.displayName ?? "",
        product: "poorplexity-premium",
      },
    }),
  });

  return {
    subscription,
    planId,
    amount: config.amount,
    currency: config.currency,
    checkoutKey: requiredEnv("RAZORPAY_KEY_ID"),
    planName: config.name,
    description: config.description,
  };
}

export async function fetchSubscription(subscriptionId: string) {
  return await razorpayRequest<RazorpaySubscription>(`/subscriptions/${subscriptionId}`, {
    method: "GET",
  });
}

export async function cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true) {
  return await razorpayRequest<RazorpaySubscription>(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      cancel_at_cycle_end: cancelAtCycleEnd,
    }),
  });
}

function secureCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifySubscriptionPaymentSignature(params: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}) {
  const { keySecret } = getApiCredentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${params.paymentId}|${params.subscriptionId}`)
    .digest("hex");
  return secureCompare(expected, params.signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secrets = getWebhookSecrets();
  if (!secrets.length) {
    throw new Error("Razorpay webhook secret is not configured");
  }

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return secureCompare(expected, signature);
  });
}

export function parseWebhookEvent(rawBody: string) {
  return JSON.parse(rawBody) as RazorpayWebhookEvent;
}

export function extractSubscriptionFromWebhook(event: RazorpayWebhookEvent) {
  return {
    eventType: event.event,
    eventCreatedAt: event.created_at ? new Date(event.created_at * 1000) : null,
    subscription: event.payload?.subscription?.entity ?? null,
    paymentId: event.payload?.payment?.entity?.id ?? null,
    paymentFailureReason: event.payload?.payment?.entity?.error_description
      || event.payload?.payment?.entity?.error_reason
      || null,
  };
}

export function getDailyMessageLimits() {
  const free = getNumberEnv("FREE_DAILY_MESSAGE_LIMIT", 2);
  const premiumRaw = getNumberEnv("PREMIUM_DAILY_MESSAGE_LIMIT", 200);
  return {
    free,
    premium: premiumRaw <= 0 ? null : premiumRaw,
  };
}
