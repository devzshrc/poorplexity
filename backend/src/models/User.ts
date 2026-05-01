import mongoose, { Schema } from "mongoose";

const appUserSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: null },
    displayName: { type: String, required: true },
    customDisplayName: { type: String, default: null },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    username: { type: String, default: null },
    publicUsername: { type: String, default: null, unique: true, sparse: true, index: true },
    imageUrl: { type: String, default: null },
    customImageUrl: { type: String, default: null },
    bio: { type: String, default: null },
    roastLevel: { type: String, enum: ["light", "medium", "high"], default: "medium" },
    responseLength: { type: String, enum: ["short", "medium", "long"], default: "short" },
    outputFormat: { type: String, enum: ["bullets", "paragraphs"], default: "bullets" },
    answerMode: { type: String, enum: ["fast", "balanced", "deep"], default: "fast" },
    preferredModel: { type: String, default: "llama-3.1-8b-instant" },
    onlyFromSources: { type: Boolean, default: false },
    defaultFolderId: { type: Schema.Types.ObjectId, ref: "ChatFolder", default: null },
    memoryNotes: { type: String, default: "" },
    hideChatSettingsPanel: { type: Boolean, default: false },
    subscriptionTier: { type: String, enum: ["free", "premium"], default: "free" },
    subscriptionStatus: { type: String, default: "inactive", index: true },
    subscriptionPlanName: { type: String, default: null },
    subscriptionAmountPaise: { type: Number, default: null },
    subscriptionCurrency: { type: String, default: null },
    razorpayCustomerId: { type: String, default: null },
    razorpayPlanId: { type: String, default: null },
    razorpaySubscriptionId: { type: String, default: null, index: true },
    razorpaySubscriptionShortUrl: { type: String, default: null },
    subscriptionCurrentStart: { type: Date, default: null },
    subscriptionCurrentEnd: { type: Date, default: null },
    subscriptionChargeAt: { type: Date, default: null },
    subscriptionCancelAtCycleEnd: { type: Boolean, default: false },
    subscriptionLastPaymentId: { type: String, default: null },
    subscriptionFailureReason: { type: String, default: null },
    subscriptionLastWebhookEventId: { type: String, default: null },
    subscriptionLastWebhookAt: { type: Date, default: null },
    premiumActivatedAt: { type: Date, default: null },
    lastSignInAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const AppUser: mongoose.Model<any> =
  (mongoose.models.AppUser as mongoose.Model<any> | undefined)
  || mongoose.model("AppUser", appUserSchema);
