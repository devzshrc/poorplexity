import type { Types } from "mongoose";

export type UserPreferenceRecord = {
  roastLevel: "light" | "medium" | "high";
  responseLength: "short" | "medium" | "long";
  outputFormat: "bullets" | "paragraphs";
  answerMode: "fast" | "balanced" | "deep";
  preferredModel: string;
  onlyFromSources: boolean;
  defaultFolderId: string | null;
  memoryNotes: string;
  hideChatSettingsPanel: boolean;
};

export type SubscriptionStatus =
  | "inactive"
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";

export type BillingRecord = {
  tier: "free" | "premium";
  status: SubscriptionStatus;
  isPremium: boolean;
  planName: string | null;
  dailyMessageLimit: number | null;
  currentStart: string | null;
  currentEnd: string | null;
  renewsAt: string | null;
  cancelAtCycleEnd: boolean;
  amountPaise: number | null;
  currency: string | null;
  razorpaySubscriptionId: string | null;
  shortUrl: string | null;
  lastPaymentId: string | null;
  lastWebhookEventId: string | null;
  failureReason: string | null;
};

export type UserProfileRecord = {
  id: string;
  clerkUserId: string;
  displayName: string;
  email: string | null;
  imageUrl: string | null;
  bio: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  publicUsername?: string | null;
  billing: BillingRecord;
  preferences: UserPreferenceRecord;
};

export type SourceRecord = {
  url: string;
  title: string;
  content: string;
};

export type MessageDocument = {
  _id: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  editedAt?: Date | null;
  sources?: SourceRecord[];
  followUps?: string[];
  contextUsed?: string[];
  confidence?: number;
  webSearchUsed?: boolean;
};

export type FolderDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  name: string;
  parentFolderId: Types.ObjectId | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AppUserDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  email: string | null;
  displayName: string;
  customDisplayName?: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  publicUsername?: string | null;
  imageUrl: string | null;
  customImageUrl?: string | null;
  bio?: string | null;
  roastLevel: UserPreferenceRecord["roastLevel"];
  responseLength: UserPreferenceRecord["responseLength"];
  outputFormat: UserPreferenceRecord["outputFormat"];
  answerMode: UserPreferenceRecord["answerMode"];
  preferredModel: string;
  onlyFromSources: boolean;
  defaultFolderId: Types.ObjectId | null;
  memoryNotes: string;
  hideChatSettingsPanel: boolean;
  subscriptionTier: BillingRecord["tier"];
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlanName: string | null;
  subscriptionAmountPaise: number | null;
  subscriptionCurrency: string | null;
  razorpayCustomerId: string | null;
  razorpayPlanId: string | null;
  razorpaySubscriptionId: string | null;
  razorpaySubscriptionShortUrl: string | null;
  subscriptionCurrentStart: Date | null;
  subscriptionCurrentEnd: Date | null;
  subscriptionChargeAt: Date | null;
  subscriptionCancelAtCycleEnd: boolean;
  subscriptionLastPaymentId: string | null;
  subscriptionFailureReason: string | null;
  subscriptionLastWebhookEventId: string | null;
  subscriptionLastWebhookAt: Date | null;
  premiumActivatedAt: Date | null;
};

export type ChatDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  folderId: Types.ObjectId | null;
  title: string;
  messages: MessageDocument[];
  lastMessageAt: Date;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  restoreUntil: Date | null;
  branchFromChatId: Types.ObjectId | null;
  branchFromMessageId: Types.ObjectId | null;
  systemPrompt: string;
  useWebSearch: boolean;
  answerMode: UserPreferenceRecord["answerMode"];
  preferredModel: string;
  responseLength: UserPreferenceRecord["responseLength"];
  outputFormat: UserPreferenceRecord["outputFormat"];
  roastLevel: UserPreferenceRecord["roastLevel"];
  onlyFromSources: boolean;
  contextWindow: number;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ActivityDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  type: string;
  entityType: "chat" | "folder" | "message" | "workspace";
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type BillingWebhookEventDocument = {
  _id: Types.ObjectId;
  eventId: string;
  eventType: string;
  razorpaySubscriptionId: string | null;
  clerkUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
