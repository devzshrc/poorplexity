import mongoose, { Schema } from "mongoose";

const billingWebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    razorpaySubscriptionId: { type: String, default: null, index: true },
    clerkUserId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

export const BillingWebhookEvent: mongoose.Model<any> =
  (mongoose.models.BillingWebhookEvent as mongoose.Model<any> | undefined)
  || mongoose.model("BillingWebhookEvent", billingWebhookEventSchema);
