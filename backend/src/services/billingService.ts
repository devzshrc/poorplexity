import * as billingRepository from "../repositories/billingRepository";
import {
  billingEnabled,
  cancelSubscription,
  createPremiumSubscription,
  extractSubscriptionFromWebhook,
  fetchSubscription,
  parseWebhookEvent,
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
} from "../razorpay";

export const billingService = {
  ...billingRepository,
  billingEnabled,
  cancelSubscription,
  createPremiumSubscription,
  extractSubscriptionFromWebhook,
  fetchSubscription,
  parseWebhookEvent,
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
};
