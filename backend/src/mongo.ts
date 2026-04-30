import mongoose, { Schema, Types } from "mongoose";
import type { User } from "@clerk/backend";
import { SUPPORTED_MODELS } from "../prompt";
import { getDailyMessageLimits } from "./razorpay";
import type { RazorpaySubscription } from "./razorpay";
import { generateChatTitle, type ConversationTurn } from "./llm";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB_NAME?.trim() || "poorplexity";

const DEFAULT_FOLDER_NAMES = [
  "Brain dump",
  "Deep work",
  "Side quests",
  "Loose ends",
  "Research lab",
  "Field notes",
  "Idea pile",
  "Signal box",
  "Workbench",
  "Thought shelf",
];

const MAX_PROFILE_TEXT_LENGTH = 280;
const MAX_MEMORY_NOTES_LENGTH = 4000;
const MAX_SYSTEM_PROMPT_LENGTH = 4000;
const MAX_CHAT_TITLE_LENGTH = 120;
const SUPPORTED_MODEL_SET = new Set<string>(SUPPORTED_MODELS);

const globalForMongoose = globalThis as typeof globalThis & {
  __poorplexityMongoosePromise?: Promise<typeof mongoose>;
};

async function getMongoose() {
  if (!globalForMongoose.__poorplexityMongoosePromise) {
    globalForMongoose.__poorplexityMongoosePromise = mongoose.connect(uri, {
      dbName,
      autoIndex: true,
    });
  }

  return globalForMongoose.__poorplexityMongoosePromise;
}

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

type SourceRecord = {
  url: string;
  title: string;
  content: string;
};

type MessageDocument = {
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

type FolderDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  name: string;
  parentFolderId: Types.ObjectId | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AppUserDocument = {
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

type ChatDocument = {
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

type ActivityDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  type: string;
  entityType: "chat" | "folder" | "message" | "workspace";
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type BillingWebhookEventDocument = {
  _id: Types.ObjectId;
  eventId: string;
  eventType: string;
  razorpaySubscriptionId: string | null;
  clerkUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const sourceSchema = new Schema(
  {
    url: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [sourceSchema], default: undefined },
    followUps: { type: [String], default: undefined },
    contextUsed: { type: [String], default: undefined },
    confidence: { type: Number, default: undefined },
    webSearchUsed: { type: Boolean, default: undefined },
    editedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

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

const folderSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: "ChatFolder", default: null, index: true },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const chatSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: "ChatFolder", default: null, index: true },
    title: { type: String, required: true, trim: true },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    isPinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    restoreUntil: { type: Date, default: null },
    branchFromChatId: { type: Schema.Types.ObjectId, ref: "Chat", default: null },
    branchFromMessageId: { type: Schema.Types.ObjectId, default: null },
    systemPrompt: { type: String, default: "" },
    useWebSearch: { type: Boolean, default: true },
    answerMode: { type: String, enum: ["fast", "balanced", "deep"], default: "fast" },
    preferredModel: { type: String, default: "llama-3.1-8b-instant" },
    responseLength: { type: String, enum: ["short", "medium", "long"], default: "short" },
    outputFormat: { type: String, enum: ["bullets", "paragraphs"], default: "bullets" },
    roastLevel: { type: String, enum: ["light", "medium", "high"], default: "medium" },
    onlyFromSources: { type: Boolean, default: false },
    contextWindow: { type: Number, default: 12 },
    summary: { type: String, default: "" },
  },
  { timestamps: true }
);

chatSchema.index({ clerkUserId: 1, isDeleted: 1, isArchived: 1, isPinned: -1, lastMessageAt: -1 });

const activitySchema = new Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    entityType: { type: String, enum: ["chat", "folder", "message", "workspace"], required: true },
    entityId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const billingWebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    razorpaySubscriptionId: { type: String, default: null, index: true },
    clerkUserId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

const AppUser: mongoose.Model<any> =
  (mongoose.models.AppUser as mongoose.Model<any> | undefined)
  || mongoose.model("AppUser", appUserSchema);
const ChatFolder: mongoose.Model<any> =
  (mongoose.models.ChatFolder as mongoose.Model<any> | undefined)
  || mongoose.model("ChatFolder", folderSchema);
const Chat: mongoose.Model<any> =
  (mongoose.models.Chat as mongoose.Model<any> | undefined)
  || mongoose.model("Chat", chatSchema);
const Activity: mongoose.Model<any> =
  (mongoose.models.Activity as mongoose.Model<any> | undefined)
  || mongoose.model("Activity", activitySchema);
const BillingWebhookEvent: mongoose.Model<any> =
  (mongoose.models.BillingWebhookEvent as mongoose.Model<any> | undefined)
  || mongoose.model("BillingWebhookEvent", billingWebhookEventSchema);

export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  editedAt?: string | null;
  sources?: SourceRecord[];
  followUps?: string[];
  contextUsed?: string[];
  confidence?: number;
  webSearchUsed?: boolean;
};

export type ChatSettingsRecord = {
  systemPrompt: string;
  useWebSearch: boolean;
  answerMode: UserPreferenceRecord["answerMode"];
  preferredModel: string;
  responseLength: UserPreferenceRecord["responseLength"];
  outputFormat: UserPreferenceRecord["outputFormat"];
  roastLevel: UserPreferenceRecord["roastLevel"];
  onlyFromSources: boolean;
  contextWindow: number;
};

function userPrimaryEmail(user: User): string | null {
  const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

function userDisplayName(user: User): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username || userPrimaryEmail(user) || user.id;
}

function ensureObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Invalid identifier");
  }
  return new Types.ObjectId(id);
}

function sanitizeNullableText(value: string | undefined, maxLength: number, field: string) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`${field} is too long`);
  }
  return trimmed;
}

function sanitizePreferredModel(model: string | undefined) {
  if (model === undefined) return undefined;
  const trimmed = model.trim();
  if (!trimmed) throw new Error("Model is required");
  if (!SUPPORTED_MODEL_SET.has(trimmed)) {
    throw new Error("Unsupported model");
  }
  return trimmed;
}

function sanitizeImageUrl(value: string | undefined) {
  const trimmed = sanitizeNullableText(value, 1000, "Image URL");
  if (trimmed === undefined || trimmed === null) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Image URL must be a valid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Image URL must use http or https");
  }

  return parsed.toString();
}

function makeChatTitle(input: string): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (!compact) return "Untitled chat";
  const sentence = compact.split(/[.!?]/)[0]?.trim() || compact;
  return sentence.length <= 60 ? sentence : `${sentence.slice(0, 57).trim()}...`;
}

async function pruneUnusedEmptyChats(clerkUserId: string, excludeChatId?: string | null) {
  const query: Record<string, unknown> = {
    clerkUserId,
    isDeleted: false,
    isPinned: false,
    isArchived: false,
    "messages.0": { $exists: false },
    title: "Untitled chat",
  };

  if (excludeChatId) {
    query._id = { $ne: ensureObjectId(excludeChatId) };
  }

  await Chat.deleteMany(query);
}

async function pickDefaultFolderName(clerkUserId: string) {
  const existing = new Set(
    (await ChatFolder.find({ clerkUserId }, { name: 1 }).lean<any[]>()).map((folder) => String(folder.name).toLowerCase())
  );
  const base = DEFAULT_FOLDER_NAMES[Math.floor(Math.random() * DEFAULT_FOLDER_NAMES.length)] ?? "New folder";
  if (!existing.has(base.toLowerCase())) return base;

  for (let attempt = 2; attempt < 50; attempt += 1) {
    const candidate = `${base} ${attempt}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }

  return `${base} ${Date.now().toString().slice(-4)}`;
}

async function findOwnedFolder(clerkUserId: string, folderId: string | Types.ObjectId) {
  const objectId = typeof folderId === "string" ? ensureObjectId(folderId) : folderId;
  return await ChatFolder.findOne({ _id: objectId, clerkUserId }).lean<any>();
}

async function resolveOwnedFolderId(clerkUserId: string, folderId: string | null | undefined) {
  if (!folderId) return null;
  const folder = await findOwnedFolder(clerkUserId, folderId);
  if (!folder) throw new Error("Folder not found");
  return ensureObjectId(String(folder._id));
}

async function assertValidFolderParent(params: {
  clerkUserId: string;
  folderId?: string | null;
  parentFolderId?: string | null;
}) {
  const { clerkUserId, folderId, parentFolderId } = params;
  if (parentFolderId === undefined) return undefined;
  if (parentFolderId === null) return null;

  const parent = await findOwnedFolder(clerkUserId, parentFolderId);
  if (!parent) throw new Error("Parent folder not found");

  const parentId = String(parent._id);
  if (folderId && parentId === folderId) {
    throw new Error("A folder cannot be its own parent");
  }

  if (folderId) {
    let cursor = parent.parentFolderId ? String(parent.parentFolderId) : null;
    while (cursor) {
      if (cursor === folderId) {
        throw new Error("Folder nesting cannot create a cycle");
      }
      const next = await ChatFolder.findOne({ _id: ensureObjectId(cursor), clerkUserId }, { parentFolderId: 1 }).lean<any>();
      cursor = next?.parentFolderId ? String(next.parentFolderId) : null;
    }
  }

  return ensureObjectId(parentId);
}

async function assertOwnedChat(clerkUserId: string, chatId: string) {
  const chat = await Chat.findOne({
    _id: ensureObjectId(chatId),
    clerkUserId,
    isDeleted: false,
  }).lean<any>();

  if (!chat) throw new Error("Chat not found");
  return chat;
}

async function assertBranchSource(params: {
  clerkUserId: string;
  branchFromChatId?: string | null;
  branchFromMessageId?: string | null;
}) {
  const { clerkUserId, branchFromChatId, branchFromMessageId } = params;
  if (!branchFromChatId && !branchFromMessageId) {
    return { chatId: null, messageId: null };
  }

  if (!branchFromChatId) {
    throw new Error("branchFromChatId is required when branchFromMessageId is provided");
  }

  const sourceChat = await assertOwnedChat(clerkUserId, branchFromChatId);
  if (!branchFromMessageId) {
    return { chatId: String(sourceChat._id), messageId: null };
  }

  const messageExists = sourceChat.messages.some((message: any) => String(message._id) === branchFromMessageId);
  if (!messageExists) {
    throw new Error("Branch source message not found");
  }

  return { chatId: String(sourceChat._id), messageId: branchFromMessageId };
}

function makePreferenceRecord(user: AppUserDocument | any): UserPreferenceRecord {
  return {
    roastLevel: user.roastLevel ?? "medium",
    responseLength: user.responseLength ?? "short",
    outputFormat: user.outputFormat ?? "bullets",
    answerMode: user.answerMode ?? "fast",
    preferredModel: user.preferredModel ?? "llama-3.1-8b-instant",
    onlyFromSources: Boolean(user.onlyFromSources),
    defaultFolderId: user.defaultFolderId ? String(user.defaultFolderId) : null,
    memoryNotes: user.memoryNotes ?? "",
    hideChatSettingsPanel: Boolean(user.hideChatSettingsPanel),
  };
}

function hasPremiumAccess(user: AppUserDocument | any, now = new Date()) {
  const status = String(user?.subscriptionStatus ?? "inactive") as SubscriptionStatus;
  const currentEnd = user?.subscriptionCurrentEnd ? new Date(user.subscriptionCurrentEnd) : null;

  if (status === "active") return true;
  if (currentEnd && currentEnd > now && ["pending", "halted", "cancelled"].includes(status)) return true;
  return false;
}

function messageLimitForUser(user: AppUserDocument | any) {
  const limits = getDailyMessageLimits();
  return hasPremiumAccess(user) ? limits.premium : limits.free;
}

function serializeBilling(user: AppUserDocument | any): BillingRecord {
  const isPremium = hasPremiumAccess(user);
  return {
    tier: (user?.subscriptionTier ?? "free") === "premium" ? "premium" : "free",
    status: (user?.subscriptionStatus ?? "inactive") as SubscriptionStatus,
    isPremium,
    planName: user?.subscriptionPlanName ?? null,
    dailyMessageLimit: messageLimitForUser(user),
    currentStart: user?.subscriptionCurrentStart ? new Date(user.subscriptionCurrentStart).toISOString() : null,
    currentEnd: user?.subscriptionCurrentEnd ? new Date(user.subscriptionCurrentEnd).toISOString() : null,
    renewsAt: user?.subscriptionCurrentEnd ? new Date(user.subscriptionCurrentEnd).toISOString() : null,
    cancelAtCycleEnd: Boolean(user?.subscriptionCancelAtCycleEnd),
    amountPaise: typeof user?.subscriptionAmountPaise === "number" ? user.subscriptionAmountPaise : null,
    currency: user?.subscriptionCurrency ?? null,
    razorpaySubscriptionId: user?.razorpaySubscriptionId ?? null,
    shortUrl: user?.razorpaySubscriptionShortUrl ?? null,
    lastPaymentId: user?.subscriptionLastPaymentId ?? null,
    lastWebhookEventId: user?.subscriptionLastWebhookEventId ?? null,
    failureReason: user?.subscriptionFailureReason ?? null,
  };
}

function serializeUserProfile(user: AppUserDocument | any): UserProfileRecord {
  return {
    id: String(user._id),
    clerkUserId: user.clerkUserId,
    displayName: user.displayName,
    email: user.email ?? null,
    imageUrl: user.imageUrl ?? null,
    bio: user.bio ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    username: user.username ?? null,
    publicUsername: user.publicUsername ?? null,
    billing: serializeBilling(user),
    preferences: makePreferenceRecord(user),
  };
}

function normalizePublicUsername(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
  if (normalized.length < 3) {
    throw new Error("Username must be at least 3 characters and use letters, numbers, or underscores");
  }
  return normalized;
}

function defaultPublicUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return normalizePublicUsername(value);
  } catch {
    return null;
  }
}

function serializeMessage(message: MessageDocument | any): ChatMessageRecord {
  return {
    id: String(message._id),
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt).toISOString(),
    ...(message.editedAt ? { editedAt: new Date(message.editedAt).toISOString() } : {}),
    ...(message.sources?.length ? { sources: message.sources } : {}),
    ...(message.followUps?.length ? { followUps: message.followUps } : {}),
    ...(message.contextUsed?.length ? { contextUsed: message.contextUsed } : {}),
    ...(typeof message.confidence === "number" ? { confidence: message.confidence } : {}),
    ...(typeof message.webSearchUsed === "boolean" ? { webSearchUsed: message.webSearchUsed } : {}),
  };
}

function serializeChatSettings(chat: ChatDocument | any): ChatSettingsRecord {
  return {
    systemPrompt: chat.systemPrompt ?? "",
    useWebSearch: Boolean(chat.useWebSearch ?? true),
    answerMode: chat.answerMode ?? "fast",
    preferredModel: chat.preferredModel ?? "llama-3.1-8b-instant",
    responseLength: chat.responseLength ?? "short",
    outputFormat: chat.outputFormat ?? "bullets",
    roastLevel: chat.roastLevel ?? "medium",
    onlyFromSources: Boolean(chat.onlyFromSources),
    contextWindow: Number(chat.contextWindow ?? 12),
  };
}

function serializeChatSummary(chat: ChatDocument | any) {
  const lastMessage = chat.messages.at(-1);
  return {
    id: String(chat._id),
    title: chat.title,
    folderId: chat.folderId ? String(chat.folderId) : null,
    updatedAt: new Date(chat.updatedAt).toISOString(),
    lastMessageAt: new Date(chat.lastMessageAt).toISOString(),
    lastMessagePreview: lastMessage?.content?.slice(0, 140) ?? "",
    lastMessageRole: lastMessage?.role ?? null,
    messageCount: chat.messages.length,
    isPinned: Boolean(chat.isPinned),
    isArchived: Boolean(chat.isArchived),
    branchFromChatId: chat.branchFromChatId ? String(chat.branchFromChatId) : null,
    branchFromMessageId: chat.branchFromMessageId ? String(chat.branchFromMessageId) : null,
  };
}

function serializeFolder(folder: FolderDocument | any) {
  return {
    id: String(folder._id),
    name: folder.name,
    parentFolderId: folder.parentFolderId ? String(folder.parentFolderId) : null,
    isFavorite: Boolean(folder.isFavorite),
    createdAt: new Date(folder.createdAt).toISOString(),
    updatedAt: new Date(folder.updatedAt).toISOString(),
  };
}

function buildConversationSummary(messages: Array<MessageDocument | any>) {
  const recentUsers = messages.filter((message) => message.role === "user").slice(-3);
  const recentAssistants = messages.filter((message) => message.role === "assistant").slice(-2);
  const parts = [
    ...recentUsers.map((message, index) => `User topic ${index + 1}: ${message.content.slice(0, 160)}`),
    ...recentAssistants.map((message, index) => `Assistant answer ${index + 1}: ${message.content.slice(0, 180)}`),
  ];
  return parts.join("\n").trim();
}

function confidenceFromSources(sources: SourceRecord[] = [], onlyFromSources = false) {
  if (sources.length >= 5) return onlyFromSources ? 0.92 : 0.88;
  if (sources.length >= 3) return onlyFromSources ? 0.84 : 0.78;
  if (sources.length >= 1) return onlyFromSources ? 0.7 : 0.62;
  return onlyFromSources ? 0.32 : 0.5;
}

async function recordActivity(params: {
  clerkUserId: string;
  type: string;
  entityType: ActivityDocument["entityType"];
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await Activity.create({
    clerkUserId: params.clerkUserId,
    type: params.type,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function findChatOrThrow(clerkUserId: string, chatId: string) {
  const chat = await Chat.findOne({
    _id: ensureObjectId(chatId),
    clerkUserId,
  }).lean<any>();

  if (!chat) throw new Error("Chat not found");
  return chat;
}

export async function ensureDatabase() {
  await getMongoose();
}

export async function getDailyUserMessageCount(clerkUserId: string, date = new Date()) {
  await ensureDatabase();

  const dayStart = startOfUtcDay(date);
  return Activity.countDocuments({
    clerkUserId,
    type: "message.user.created",
    createdAt: { $gte: dayStart },
  });
}

export async function syncUser(user: User) {
  await ensureDatabase();

  const now = new Date();
  const syncedUser = await AppUser.findOneAndUpdate(
    { clerkUserId: user.id },
    {
      $set: {
        email: userPrimaryEmail(user),
        displayName: userDisplayName(user),
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        username: user.username ?? null,
        imageUrl: user.imageUrl ?? null,
        lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
        lastSeenAt: now,
      },
      $setOnInsert: {
        clerkUserId: user.id,
        customDisplayName: null,
        customImageUrl: null,
        bio: null,
        roastLevel: "medium",
        responseLength: "short",
        outputFormat: "bullets",
        answerMode: "fast",
        preferredModel: "llama-3.1-8b-instant",
        onlyFromSources: false,
        defaultFolderId: null,
        memoryNotes: "",
        hideChatSettingsPanel: false,
        publicUsername: defaultPublicUsername(user.username),
        subscriptionTier: "free",
        subscriptionStatus: "inactive",
        subscriptionPlanName: null,
        subscriptionAmountPaise: null,
        subscriptionCurrency: null,
        razorpayCustomerId: null,
        razorpayPlanId: null,
        razorpaySubscriptionId: null,
        razorpaySubscriptionShortUrl: null,
        subscriptionCurrentStart: null,
        subscriptionCurrentEnd: null,
        subscriptionChargeAt: null,
        subscriptionCancelAtCycleEnd: false,
        subscriptionLastPaymentId: null,
        subscriptionFailureReason: null,
        subscriptionLastWebhookEventId: null,
        subscriptionLastWebhookAt: null,
        premiumActivatedAt: null,
      },
    },
    { upsert: true, new: true, lean: true }
  ) as any;

  if (!syncedUser) throw new Error("Unable to synchronize user profile");

  const effectiveUser = {
    ...syncedUser,
    displayName: syncedUser.customDisplayName?.trim() || syncedUser.displayName,
    imageUrl: syncedUser.customImageUrl?.trim() || syncedUser.imageUrl,
  };

  return serializeUserProfile(effectiveUser);
}

export async function getWorkspace(clerkUserId: string) {
  await ensureDatabase();
  await pruneUnusedEmptyChats(clerkUserId);

  const [user, folders, chats, trash, activity] = await Promise.all([
    AppUser.findOne({ clerkUserId }).lean<any>(),
    ChatFolder.find({ clerkUserId }).sort({ isFavorite: -1, name: 1 }).lean<any[]>(),
    Chat.find({ clerkUserId, isDeleted: false }).sort({ isPinned: -1, lastMessageAt: -1 }).lean<any[]>(),
    Chat.find({ clerkUserId, isDeleted: true, restoreUntil: { $gt: new Date() } }).sort({ deletedAt: -1 }).lean<any[]>(),
    Activity.find({ clerkUserId }).sort({ createdAt: -1 }).limit(20).lean<any[]>(),
  ]) as [any, any[], any[], any[], any[]];

  const sentToday = await getDailyUserMessageCount(clerkUserId);
  const dailyLimit = user ? messageLimitForUser(user) : getDailyMessageLimits().free;

  return {
    user: user ? serializeUserProfile({
      ...user,
      displayName: user.customDisplayName?.trim() || user.displayName,
      imageUrl: user.customImageUrl?.trim() || user.imageUrl,
    }) : null,
    folders: folders.map(serializeFolder),
    chats: chats.map(serializeChatSummary),
    trash: trash.map(serializeChatSummary),
    usage: {
      sentToday,
      remainingToday: dailyLimit === null ? null : Math.max(0, dailyLimit - sentToday),
      dailyLimit,
      deletedRecoverableCount: trash.length,
      activity: activity.map((item) => ({
        id: String(item._id),
        type: item.type,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata ?? {},
        createdAt: new Date(item.createdAt).toISOString(),
      })),
    },
  };
}

export async function updateUserProfile(
  clerkUserId: string,
  profile: {
    displayName?: string;
    imageUrl?: string;
    bio?: string;
    publicUsername?: string;
  }
) {
  await ensureDatabase();

  const patch: Record<string, unknown> = {};
  if (profile.displayName !== undefined) patch.customDisplayName = sanitizeNullableText(profile.displayName, 80, "Display name");
  if (profile.imageUrl !== undefined) patch.customImageUrl = sanitizeImageUrl(profile.imageUrl);
  if (profile.bio !== undefined) patch.bio = sanitizeNullableText(profile.bio, MAX_PROFILE_TEXT_LENGTH, "Bio");
  if (profile.publicUsername !== undefined) {
    patch.publicUsername = profile.publicUsername.trim() ? normalizePublicUsername(profile.publicUsername) : null;
  }

  if (patch.publicUsername) {
    const existing = await AppUser.findOne({ publicUsername: patch.publicUsername, clerkUserId: { $ne: clerkUserId } }).lean<any>();
    if (existing) throw new Error("Username is already taken");
  }

  const user = await AppUser.findOneAndUpdate(
    { clerkUserId },
    { $set: patch },
    { new: true, lean: true }
  ) as any;

  if (!user) throw new Error("User not found");

  await recordActivity({
    clerkUserId,
    type: "user.profile.updated",
    entityType: "workspace",
    entityId: String(user._id),
    metadata: patch,
  });

  return serializeUserProfile({
    ...user,
    displayName: user.customDisplayName?.trim() || user.displayName,
    imageUrl: user.customImageUrl?.trim() || user.imageUrl,
  });
}

export async function updateUserPreferences(
  clerkUserId: string,
  preferences: Partial<UserPreferenceRecord>
) {
  await ensureDatabase();

  const patch: Record<string, unknown> = {};
  if (preferences.roastLevel) patch.roastLevel = preferences.roastLevel;
  if (preferences.responseLength) patch.responseLength = preferences.responseLength;
  if (preferences.outputFormat) patch.outputFormat = preferences.outputFormat;
  if (preferences.answerMode) patch.answerMode = preferences.answerMode;
  if (preferences.preferredModel !== undefined) patch.preferredModel = sanitizePreferredModel(preferences.preferredModel);
  if (typeof preferences.onlyFromSources === "boolean") patch.onlyFromSources = preferences.onlyFromSources;
  if (preferences.defaultFolderId !== undefined) {
    patch.defaultFolderId = await resolveOwnedFolderId(clerkUserId, preferences.defaultFolderId);
  }
  if (preferences.memoryNotes !== undefined) patch.memoryNotes = sanitizeNullableText(preferences.memoryNotes, MAX_MEMORY_NOTES_LENGTH, "Memory notes") ?? "";
  if (typeof preferences.hideChatSettingsPanel === "boolean") patch.hideChatSettingsPanel = preferences.hideChatSettingsPanel;

  const user = await AppUser.findOneAndUpdate(
    { clerkUserId },
    { $set: patch },
    { new: true, lean: true }
  ) as any;

  if (!user) throw new Error("User not found");

  await recordActivity({
    clerkUserId,
    type: "user.preferences.updated",
    entityType: "workspace",
    entityId: String(user._id),
    metadata: patch,
  });

  return serializeUserProfile({
    ...user,
    displayName: user.customDisplayName?.trim() || user.displayName,
    imageUrl: user.customImageUrl?.trim() || user.imageUrl,
  });
}

export async function exportUserData(clerkUserId: string) {
  await ensureDatabase();

  const [user, folders, chats, activities] = await Promise.all([
    AppUser.findOne({ clerkUserId }).lean<any>(),
    ChatFolder.find({ clerkUserId }).sort({ updatedAt: -1 }).lean<any[]>(),
    Chat.find({ clerkUserId }).sort({ updatedAt: -1 }).lean<any[]>(),
    Activity.find({ clerkUserId }).sort({ createdAt: -1 }).lean<any[]>(),
  ]) as [any, any[], any[], any[]];

  return {
    exportedAt: new Date().toISOString(),
    user: user ? serializeUserProfile({
      ...user,
      displayName: user.customDisplayName?.trim() || user.displayName,
      imageUrl: user.customImageUrl?.trim() || user.imageUrl,
    }) : null,
    folders: folders.map(serializeFolder),
    chats: chats.map((chat) => ({
      ...serializeChatSummary(chat),
      settings: serializeChatSettings(chat),
      summary: chat.summary ?? "",
      deletedAt: chat.deletedAt ? new Date(chat.deletedAt).toISOString() : null,
      restoreUntil: chat.restoreUntil ? new Date(chat.restoreUntil).toISOString() : null,
      messages: chat.messages.map(serializeMessage),
    })),
    activity: activities.map((item) => ({
      id: String(item._id),
      type: item.type,
      entityType: item.entityType,
      entityId: item.entityId,
      metadata: item.metadata ?? {},
      createdAt: new Date(item.createdAt).toISOString(),
    })),
  };
}

export async function getPublicProfile(username: string) {
  await ensureDatabase();
  const normalized = normalizePublicUsername(username);
  const user = await AppUser.findOne({ publicUsername: normalized }).lean<any>();
  if (!user) throw new Error("Profile not found");

  const [chats, folders, sentToday] = await Promise.all([
    Chat.find({ clerkUserId: user.clerkUserId, isDeleted: false }).lean<any[]>(),
    ChatFolder.find({ clerkUserId: user.clerkUserId }).lean<any[]>(),
    getDailyUserMessageCount(user.clerkUserId),
  ]);

  const totalMessages = chats.reduce((sum, chat) => sum + chat.messages.length, 0);
  const userMessages = chats.reduce((sum, chat) => sum + chat.messages.filter((message: any) => message.role === "user").length, 0);
  const assistantMessages = totalMessages - userMessages;
  const activeDays = new Set(
    chats.flatMap((chat) => chat.messages.map((message: any) => new Date(message.createdAt).toISOString().slice(0, 10)))
  ).size;

  return {
    profile: {
      displayName: user.customDisplayName?.trim() || user.displayName,
      imageUrl: user.customImageUrl?.trim() || user.imageUrl,
      bio: user.bio ?? "",
      publicUsername: user.publicUsername,
    },
    stats: {
      totalChats: chats.length,
      archivedChats: chats.filter((chat) => chat.isArchived).length,
      pinnedChats: chats.filter((chat) => chat.isPinned).length,
      totalMessages,
      userMessages,
      assistantMessages,
      folders: folders.length,
      activeDays,
      sentToday,
      averageMessagesPerChat: chats.length ? Number((totalMessages / chats.length).toFixed(1)) : 0,
      averageUserMessageLength: userMessages
        ? Math.round(
            chats.flatMap((chat) => chat.messages.filter((message: any) => message.role === "user"))
              .reduce((sum, message: any) => sum + String(message.content ?? "").length, 0) / userMessages
          )
        : 0,
    },
  };
}

export async function deleteStoredUserData(clerkUserId: string) {
  await ensureDatabase();

  await Promise.all([
    Chat.deleteMany({ clerkUserId }),
    ChatFolder.deleteMany({ clerkUserId }),
    Activity.deleteMany({ clerkUserId }),
    BillingWebhookEvent.deleteMany({ clerkUserId }),
    AppUser.deleteOne({ clerkUserId }),
  ]);
}

export async function createFolder(clerkUserId: string, name: string, parentFolderId?: string | null) {
  await ensureDatabase();
  const rawName = name.trim();
  if (rawName && rawName.length > 80) throw new Error("Folder name is too long");
  const trimmed = rawName || await pickDefaultFolderName(clerkUserId);
  const resolvedParentFolderId = await assertValidFolderParent({ clerkUserId, parentFolderId: parentFolderId ?? null });
  const folder = await ChatFolder.create({
    clerkUserId,
    name: trimmed,
    parentFolderId: resolvedParentFolderId ?? null,
  });
  await recordActivity({
    clerkUserId,
    type: "folder.created",
    entityType: "folder",
    entityId: String(folder._id),
    metadata: { name: trimmed, parentFolderId: resolvedParentFolderId ? String(resolvedParentFolderId) : null },
  });
  return serializeFolder(folder.toObject());
}

export async function renameFolder(
  clerkUserId: string,
  folderId: string,
  updates: {
    name?: string;
    parentFolderId?: string | null;
    isFavorite?: boolean;
  }
) {
  await ensureDatabase();
  const patch: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error("Folder name is required");
    if (trimmed.length > 80) throw new Error("Folder name is too long");
    patch.name = trimmed;
  }

  if (updates.parentFolderId !== undefined) {
    patch.parentFolderId = await assertValidFolderParent({
      clerkUserId,
      folderId,
      parentFolderId: updates.parentFolderId,
    }) ?? null;
  }

  if (typeof updates.isFavorite === "boolean") {
    patch.isFavorite = updates.isFavorite;
  }

  const folder = await ChatFolder.findOneAndUpdate(
    { _id: ensureObjectId(folderId), clerkUserId },
    { $set: patch },
    { new: true, lean: true }
  ) as any;

  if (!folder) throw new Error("Folder not found");
  await recordActivity({
    clerkUserId,
    type: "folder.updated",
    entityType: "folder",
    entityId: String(folder._id),
    metadata: patch,
  });
  return serializeFolder(folder);
}

export async function deleteFolder(clerkUserId: string, folderId: string) {
  await ensureDatabase();
  const objectId = ensureObjectId(folderId);
  const exists = await ChatFolder.exists({ _id: objectId, clerkUserId });
  if (!exists) throw new Error("Folder not found");

  await Promise.all([
    Chat.updateMany({ clerkUserId, folderId: objectId }, { $set: { folderId: null } }),
    ChatFolder.updateMany({ clerkUserId, parentFolderId: objectId }, { $set: { parentFolderId: null } }),
    AppUser.updateOne({ clerkUserId, defaultFolderId: objectId }, { $set: { defaultFolderId: null } }),
    ChatFolder.deleteOne({ _id: objectId, clerkUserId }),
  ]);
  await recordActivity({
    clerkUserId,
    type: "folder.deleted",
    entityType: "folder",
    entityId: String(objectId),
  });
}

async function loadUserDefaults(clerkUserId: string) {
  const user = await AppUser.findOne({ clerkUserId }).lean<any>();
  return user ? makePreferenceRecord(user) : {
    roastLevel: "medium",
    responseLength: "short",
    outputFormat: "bullets",
    answerMode: "fast",
    preferredModel: "llama-3.1-8b-instant",
    onlyFromSources: false,
    defaultFolderId: null,
    memoryNotes: "",
  };
}

export async function createChat(params: {
  clerkUserId: string;
  folderId?: string | null;
  title?: string;
  firstMessage?: string;
  branchFromChatId?: string | null;
  branchFromMessageId?: string | null;
}) {
  await ensureDatabase();
  await pruneUnusedEmptyChats(params.clerkUserId);

  const defaults = await loadUserDefaults(params.clerkUserId);
  const title = params.title?.trim() || makeChatTitle(params.firstMessage || "");
  const chosenFolderId = params.folderId ?? defaults.defaultFolderId;
  const folderId = await resolveOwnedFolderId(params.clerkUserId, chosenFolderId);
  const branchSource = await assertBranchSource({
    clerkUserId: params.clerkUserId,
    branchFromChatId: params.branchFromChatId,
    branchFromMessageId: params.branchFromMessageId,
  });

  const chat = await Chat.create({
    clerkUserId: params.clerkUserId,
    folderId,
    title: (title || "Untitled chat").slice(0, MAX_CHAT_TITLE_LENGTH),
    messages: [],
    lastMessageAt: new Date(),
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    restoreUntil: null,
    branchFromChatId: branchSource.chatId ? ensureObjectId(branchSource.chatId) : null,
    branchFromMessageId: branchSource.messageId ? ensureObjectId(branchSource.messageId) : null,
    systemPrompt: "",
    useWebSearch: true,
    answerMode: defaults.answerMode,
    preferredModel: defaults.preferredModel,
    responseLength: defaults.responseLength,
    outputFormat: defaults.outputFormat,
    roastLevel: defaults.roastLevel,
    onlyFromSources: defaults.onlyFromSources,
    contextWindow: 12,
    summary: "",
  });

  await recordActivity({
    clerkUserId: params.clerkUserId,
    type: "chat.created",
    entityType: "chat",
    entityId: String(chat._id),
    metadata: {
      folderId: folderId ? String(folderId) : null,
      title: chat.title,
      branchFromChatId: branchSource.chatId,
      branchFromMessageId: branchSource.messageId,
    },
  });

  return serializeChatSummary(chat.toObject());
}

export async function getChatDetail(clerkUserId: string, chatId: string) {
  await ensureDatabase();
  const chat = await findChatOrThrow(clerkUserId, chatId);

  return {
    ...serializeChatSummary(chat),
    settings: serializeChatSettings(chat),
    summary: chat.summary ?? "",
    deletedAt: chat.deletedAt ? new Date(chat.deletedAt).toISOString() : null,
    restoreUntil: chat.restoreUntil ? new Date(chat.restoreUntil).toISOString() : null,
    messages: chat.messages.map(serializeMessage),
  };
}

export async function updateChat(
  clerkUserId: string,
  chatId: string,
  updates: {
    title?: string;
    folderId?: string | null;
    isPinned?: boolean;
    isArchived?: boolean;
    systemPrompt?: string;
    useWebSearch?: boolean;
    answerMode?: UserPreferenceRecord["answerMode"];
    preferredModel?: string;
    responseLength?: UserPreferenceRecord["responseLength"];
    outputFormat?: UserPreferenceRecord["outputFormat"];
    roastLevel?: UserPreferenceRecord["roastLevel"];
    onlyFromSources?: boolean;
    contextWindow?: number;
  }
) {
  await ensureDatabase();

  const patch: Record<string, unknown> = {};
  if (typeof updates.title === "string") {
    const trimmed = updates.title.trim();
    if (!trimmed) throw new Error("Chat title is required");
    if (trimmed.length > MAX_CHAT_TITLE_LENGTH) throw new Error("Chat title is too long");
    patch.title = trimmed;
  }
  if (updates.folderId !== undefined) patch.folderId = await resolveOwnedFolderId(clerkUserId, updates.folderId);
  if (typeof updates.isPinned === "boolean") patch.isPinned = updates.isPinned;
  if (typeof updates.isArchived === "boolean") patch.isArchived = updates.isArchived;
  if (typeof updates.systemPrompt === "string") patch.systemPrompt = sanitizeNullableText(updates.systemPrompt, MAX_SYSTEM_PROMPT_LENGTH, "System prompt") ?? "";
  if (typeof updates.useWebSearch === "boolean") patch.useWebSearch = updates.useWebSearch;
  if (updates.answerMode) patch.answerMode = updates.answerMode;
  if (updates.preferredModel !== undefined) patch.preferredModel = sanitizePreferredModel(updates.preferredModel);
  if (updates.responseLength) patch.responseLength = updates.responseLength;
  if (updates.outputFormat) patch.outputFormat = updates.outputFormat;
  if (updates.roastLevel) patch.roastLevel = updates.roastLevel;
  if (typeof updates.onlyFromSources === "boolean") patch.onlyFromSources = updates.onlyFromSources;
  if (typeof updates.contextWindow === "number") patch.contextWindow = Math.min(20, Math.max(4, Math.round(updates.contextWindow)));

  const chat = await Chat.findOneAndUpdate(
    { _id: ensureObjectId(chatId), clerkUserId, isDeleted: false },
    { $set: patch },
    { new: true, lean: true }
  ) as any;

  if (!chat) throw new Error("Chat not found");
  await recordActivity({
    clerkUserId,
    type: "chat.updated",
    entityType: "chat",
    entityId: String(chat._id),
    metadata: patch,
  });
  return serializeChatSummary(chat);
}

export async function archiveChat(clerkUserId: string, chatId: string, isArchived: boolean) {
  return updateChat(clerkUserId, chatId, { isArchived });
}

export async function pinChat(clerkUserId: string, chatId: string, isPinned: boolean) {
  return updateChat(clerkUserId, chatId, { isPinned });
}

export async function softDeleteChat(clerkUserId: string, chatId: string) {
  await ensureDatabase();
  const restoreUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const chat = await Chat.findOneAndUpdate(
    { _id: ensureObjectId(chatId), clerkUserId, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        restoreUntil,
      },
    },
    { new: true, lean: true }
  ) as any;

  if (!chat) throw new Error("Chat not found");
  await recordActivity({
    clerkUserId,
    type: "chat.deleted.soft",
    entityType: "chat",
    entityId: String(chat._id),
    metadata: { restoreUntil: restoreUntil.toISOString() },
  });
}

export async function restoreChat(clerkUserId: string, chatId: string) {
  await ensureDatabase();
  const chat = await Chat.findOneAndUpdate(
    {
      _id: ensureObjectId(chatId),
      clerkUserId,
      isDeleted: true,
      restoreUntil: { $gt: new Date() },
    },
    {
      $set: {
        isDeleted: false,
        deletedAt: null,
        restoreUntil: null,
      },
    },
    { new: true, lean: true }
  ) as any;

  if (!chat) throw new Error("Chat not found or restore window expired");
  await recordActivity({
    clerkUserId,
    type: "chat.restored",
    entityType: "chat",
    entityId: String(chat._id),
  });
  return serializeChatSummary(chat);
}

export async function branchChat(clerkUserId: string, chatId: string, messageId?: string | null) {
  await ensureDatabase();
  const sourceChat = await assertOwnedChat(clerkUserId, chatId);
  const branchAt = messageId
    ? sourceChat.messages.findIndex((message: any) => String(message._id) === messageId)
    : sourceChat.messages.length - 1;

  if (branchAt < 0) throw new Error("Message not found");

  const clonedMessages = sourceChat.messages.slice(0, branchAt + 1).map((message: any) => ({
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
    ...(message.sources?.length ? { sources: message.sources } : {}),
    ...(message.followUps?.length ? { followUps: message.followUps } : {}),
    ...(message.contextUsed?.length ? { contextUsed: message.contextUsed } : {}),
    ...(typeof message.confidence === "number" ? { confidence: message.confidence } : {}),
    ...(typeof message.webSearchUsed === "boolean" ? { webSearchUsed: message.webSearchUsed } : {}),
  }));

  const branched = await Chat.create({
    clerkUserId,
    folderId: sourceChat.folderId ?? null,
    title: `${sourceChat.title} (Branch)`,
    messages: clonedMessages,
    lastMessageAt: clonedMessages.at(-1)?.createdAt ?? new Date(),
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    restoreUntil: null,
    branchFromChatId: sourceChat._id,
    branchFromMessageId: sourceChat.messages[branchAt]?._id ?? null,
    systemPrompt: sourceChat.systemPrompt ?? "",
    useWebSearch: Boolean(sourceChat.useWebSearch),
    answerMode: sourceChat.answerMode ?? "fast",
    preferredModel: sourceChat.preferredModel ?? "llama-3.1-8b-instant",
    responseLength: sourceChat.responseLength ?? "short",
    outputFormat: sourceChat.outputFormat ?? "bullets",
    roastLevel: sourceChat.roastLevel ?? "medium",
    onlyFromSources: Boolean(sourceChat.onlyFromSources),
    contextWindow: Number(sourceChat.contextWindow ?? 12),
    summary: buildConversationSummary(clonedMessages),
  });

  await recordActivity({
    clerkUserId,
    type: "chat.branched",
    entityType: "chat",
    entityId: String(branched._id),
    metadata: {
      sourceChatId: String(sourceChat._id),
      sourceMessageId: messageId ?? null,
    },
  });

  return serializeChatSummary(branched.toObject());
}

export async function rewriteChatFromMessage(
  clerkUserId: string,
  chatId: string,
  messageId: string,
  nextContent?: string
) {
  await ensureDatabase();
  const chat = await findChatOrThrow(clerkUserId, chatId);
  const index = chat.messages.findIndex((message: any) => String(message._id) === messageId);
  if (index < 0) throw new Error("Message not found");
  if (chat.messages[index]?.role !== "user") throw new Error("Only user messages can be edited");

  const rewritten = chat.messages.slice(0, index + 1).map((message: any, currentIndex: number) => {
    if (currentIndex !== index || nextContent === undefined) return message;
    return {
      ...message,
      content: nextContent,
      editedAt: new Date(),
    };
  });

  const firstUser = rewritten.find((message: any) => message.role === "user");
  let title = firstUser ? makeChatTitle(firstUser.content) : chat.title;

  if (firstUser) {
    const titleContext: ConversationTurn[] = rewritten
      .filter((message: any) => message.role === "user" || message.role === "assistant")
      .slice(0, 4)
      .map((message: any) => ({
        role: message.role,
        content: String(message.content ?? ""),
      }));

    title = await generateChatTitle(titleContext).catch(() => null) ?? title;
  }

  const updated = await Chat.findOneAndUpdate(
    { _id: chat._id, clerkUserId },
    {
      $set: {
        title,
        messages: rewritten,
        lastMessageAt: rewritten.at(-1)?.createdAt ?? new Date(),
        summary: buildConversationSummary(rewritten),
      },
    },
    { new: true, lean: true }
  ) as any;

  if (!updated) throw new Error("Chat not found");

  await recordActivity({
    clerkUserId,
    type: nextContent === undefined ? "chat.rewound" : "message.user.edited",
    entityType: "message",
    entityId: messageId,
    metadata: { chatId, contentLength: nextContent?.length ?? undefined },
  });

  return {
    ...serializeChatSummary(updated),
    settings: serializeChatSettings(updated),
    summary: updated.summary ?? "",
    deletedAt: updated.deletedAt ? new Date(updated.deletedAt).toISOString() : null,
    restoreUntil: updated.restoreUntil ? new Date(updated.restoreUntil).toISOString() : null,
    messages: updated.messages.map(serializeMessage),
  };
}

export async function appendMessage(params: {
  clerkUserId: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRecord[];
  followUps?: string[];
  contextUsed?: string[];
  confidence?: number;
  webSearchUsed?: boolean;
}) {
  await ensureDatabase();

  const createdAt = new Date();
  const chat = await Chat.findOneAndUpdate(
    { _id: ensureObjectId(params.chatId), clerkUserId: params.clerkUserId, isDeleted: false },
    {
      $push: {
        messages: {
          role: params.role,
          content: params.content,
          ...(params.sources?.length ? { sources: params.sources } : {}),
          ...(params.followUps?.length ? { followUps: params.followUps } : {}),
          ...(params.contextUsed?.length ? { contextUsed: params.contextUsed } : {}),
          ...(typeof params.confidence === "number" ? { confidence: params.confidence } : {}),
          ...(typeof params.webSearchUsed === "boolean" ? { webSearchUsed: params.webSearchUsed } : {}),
          createdAt,
        },
      },
      $set: {
        lastMessageAt: createdAt,
        isArchived: false,
      },
    },
    { new: true, lean: true }
  ) as any;

  if (!chat) throw new Error("Chat not found");

  let nextTitle = chat.title;
  if (chat.messages.filter((message: any) => message.role === "user").length === 1 && chat.title === "Untitled chat") {
    const titleContext: ConversationTurn[] = chat.messages
      .filter((message: any) => message.role === "user" || message.role === "assistant")
      .slice(0, 4)
      .map((message: any) => ({
        role: message.role,
        content: String(message.content ?? ""),
      }));

    nextTitle = await generateChatTitle(titleContext).catch(() => null) ?? makeChatTitle(params.content);
  }

  const nextSummary = buildConversationSummary(chat.messages);
  await Chat.updateOne(
    { _id: chat._id },
    {
      $set: {
        title: nextTitle,
        summary: nextSummary,
      },
    }
  );
  chat.title = nextTitle;
  chat.summary = nextSummary;

  await recordActivity({
    clerkUserId: params.clerkUserId,
    type: params.role === "user" ? "message.user.created" : "message.assistant.created",
    entityType: "message",
    entityId: String(chat.messages.at(-1)?._id ?? ""),
    metadata: {
      chatId: String(chat._id),
      role: params.role,
      contentLength: params.content.length,
    },
  });

  return {
    summary: serializeChatSummary(chat),
    messages: chat.messages.map(serializeMessage),
  };
}

export async function getChatContext(clerkUserId: string, chatId: string, limit?: number) {
  await ensureDatabase();
  const chat = await findChatOrThrow(clerkUserId, chatId);

  const contextWindow = Math.min(
    20,
    Math.max(4, limit ?? Number(chat.contextWindow ?? 12))
  );

  return {
    title: chat.title,
    summary: chat.summary ?? "",
    settings: serializeChatSettings(chat),
    messages: chat.messages.slice(-contextWindow).map((message: MessageDocument | any) => ({
      role: message.role,
      content: message.content,
    })),
  };
}

export async function searchWorkspace(clerkUserId: string, query: string) {
  await ensureDatabase();
  const needle = query.trim().toLowerCase();
  if (!needle) return { chats: [], messages: [] };

  const chats = await Chat.find({ clerkUserId, isDeleted: false }).lean<any[]>();
  const matchedChats = chats
    .filter((chat) =>
      chat.title.toLowerCase().includes(needle)
      || chat.summary?.toLowerCase().includes(needle)
      || chat.messages.some((message: any) => message.content.toLowerCase().includes(needle))
    )
    .slice(0, 20)
    .map((chat) => serializeChatSummary(chat));

  const matchedMessages = chats.flatMap((chat) =>
    chat.messages
      .filter((message: any) => message.content.toLowerCase().includes(needle))
      .slice(-5)
      .map((message: any) => ({
        chatId: String(chat._id),
        chatTitle: chat.title,
        ...serializeMessage(message),
      }))
  ).slice(0, 30);

  await recordActivity({
    clerkUserId,
    type: "workspace.searched",
    entityType: "workspace",
    metadata: { query: query.trim() },
  });

  return {
    chats: matchedChats,
    messages: matchedMessages,
  };
}

export async function getUsageDashboard(clerkUserId: string) {
  await ensureDatabase();

  const [user, sentToday, activity, totalChats, archivedChats] = await Promise.all([
    AppUser.findOne({ clerkUserId }).lean<any>(),
    getDailyUserMessageCount(clerkUserId),
    Activity.find({ clerkUserId }).sort({ createdAt: -1 }).limit(50).lean<any[]>(),
    Chat.countDocuments({ clerkUserId, isDeleted: false }),
    Chat.countDocuments({ clerkUserId, isArchived: true, isDeleted: false }),
  ]);

  const dailyLimit = user ? messageLimitForUser(user) : getDailyMessageLimits().free;

  return {
    sentToday,
    remainingToday: dailyLimit === null ? null : Math.max(0, dailyLimit - sentToday),
    dailyLimit,
    totalChats,
    archivedChats,
    activity: activity.map((item) => ({
      id: String(item._id),
      type: item.type,
      entityType: item.entityType,
      entityId: item.entityId,
      metadata: item.metadata ?? {},
      createdAt: new Date(item.createdAt).toISOString(),
    })),
  };
}

export async function getBillingSummary(clerkUserId: string) {
  await ensureDatabase();
  const user = await AppUser.findOne({ clerkUserId }).lean<any>();
  if (!user) throw new Error("User not found");
  return serializeBilling(user);
}

export async function getMessageEntitlement(clerkUserId: string) {
  await ensureDatabase();
  const user = await AppUser.findOne({ clerkUserId }).lean<any>();
  const sentToday = await getDailyUserMessageCount(clerkUserId);
  const dailyLimit = user ? messageLimitForUser(user) : getDailyMessageLimits().free;

  return {
    billing: user ? serializeBilling(user) : null,
    sentToday,
    dailyLimit,
    remainingToday: dailyLimit === null ? null : Math.max(0, dailyLimit - sentToday),
  };
}

function toDateOrNull(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

export async function applySubscriptionSnapshot(params: {
  clerkUserId: string;
  subscription: RazorpaySubscription;
  planName?: string | null;
  amountPaise?: number | null;
  currency?: string | null;
  lastPaymentId?: string | null;
  failureReason?: string | null;
  webhookEventId?: string | null;
  webhookReceivedAt?: Date | null;
}) {
  await ensureDatabase();

  const status = (params.subscription.status || "inactive") as SubscriptionStatus;
  const currentEnd = toDateOrNull(params.subscription.current_end);
  const patch: Record<string, unknown> = {
    subscriptionTier: ["active", "authenticated", "pending", "halted", "created"].includes(status) ? "premium" : "free",
    subscriptionStatus: status,
    subscriptionPlanName: params.planName ?? null,
    subscriptionAmountPaise: params.amountPaise ?? null,
    subscriptionCurrency: params.currency ?? null,
    razorpayCustomerId: params.subscription.customer_id ?? null,
    razorpayPlanId: params.subscription.plan_id ?? null,
    razorpaySubscriptionId: params.subscription.id ?? null,
    razorpaySubscriptionShortUrl: params.subscription.short_url ?? null,
    subscriptionCurrentStart: toDateOrNull(params.subscription.current_start),
    subscriptionCurrentEnd: currentEnd,
    subscriptionChargeAt: toDateOrNull(params.subscription.charge_at),
    subscriptionCancelAtCycleEnd: status === "active" && params.subscription.has_scheduled_changes === true,
    subscriptionLastPaymentId: params.lastPaymentId ?? null,
    subscriptionFailureReason: params.failureReason ?? null,
  };

  if (params.webhookEventId) patch.subscriptionLastWebhookEventId = params.webhookEventId;
  if (params.webhookReceivedAt) patch.subscriptionLastWebhookAt = params.webhookReceivedAt;
  if (status === "active") patch.premiumActivatedAt = new Date();
  if (["cancelled", "completed", "expired"].includes(status) && (!currentEnd || currentEnd <= new Date())) {
    patch.subscriptionTier = "free";
  }

  const user = await AppUser.findOneAndUpdate(
    { clerkUserId: params.clerkUserId },
    { $set: patch },
    { new: true, lean: true }
  ) as any;

  if (!user) throw new Error("User not found");

  await recordActivity({
    clerkUserId: params.clerkUserId,
    type: "billing.subscription.synced",
    entityType: "workspace",
    entityId: String(user._id),
    metadata: {
      subscriptionId: params.subscription.id,
      status,
      currentEnd: currentEnd?.toISOString() ?? null,
      lastPaymentId: params.lastPaymentId ?? null,
      failureReason: params.failureReason ?? null,
    },
  });

  return serializeBilling(user);
}

export async function findBillingUserBySubscriptionId(subscriptionId: string) {
  await ensureDatabase();
  const user = await AppUser.findOne({ razorpaySubscriptionId: subscriptionId }).lean<any>();
  return user ? {
    clerkUserId: user.clerkUserId,
    billing: serializeBilling(user),
  } : null;
}

export async function markSubscriptionCheckoutPending(params: {
  clerkUserId: string;
  subscription: RazorpaySubscription;
  planName: string;
  amountPaise: number;
  currency: string;
}) {
  await ensureDatabase();
  const status = (params.subscription.status || "created") as SubscriptionStatus;
  const user = await AppUser.findOneAndUpdate(
    { clerkUserId: params.clerkUserId },
    {
      $set: {
        subscriptionTier: "free",
        subscriptionStatus: status,
        subscriptionPlanName: params.planName,
        subscriptionAmountPaise: params.amountPaise,
        subscriptionCurrency: params.currency,
        razorpayPlanId: params.subscription.plan_id,
        razorpaySubscriptionId: params.subscription.id,
        razorpaySubscriptionShortUrl: params.subscription.short_url ?? null,
        subscriptionChargeAt: toDateOrNull(params.subscription.charge_at),
        subscriptionCurrentStart: toDateOrNull(params.subscription.current_start),
        subscriptionCurrentEnd: toDateOrNull(params.subscription.current_end),
        subscriptionCancelAtCycleEnd: false,
        subscriptionFailureReason: null,
      },
    },
    { new: true, lean: true }
  ) as any;

  if (!user) throw new Error("User not found");

  await recordActivity({
    clerkUserId: params.clerkUserId,
    type: "billing.subscription.created",
    entityType: "workspace",
    entityId: String(user._id),
    metadata: {
      subscriptionId: params.subscription.id,
      status,
      amountPaise: params.amountPaise,
      currency: params.currency,
    },
  });

  return serializeBilling(user);
}

export async function recordBillingWebhookEvent(params: {
  eventId: string;
  eventType: string;
  razorpaySubscriptionId?: string | null;
  clerkUserId?: string | null;
}) {
  await ensureDatabase();
  try {
    await BillingWebhookEvent.create({
      eventId: params.eventId,
      eventType: params.eventType,
      razorpaySubscriptionId: params.razorpaySubscriptionId ?? null,
      clerkUserId: params.clerkUserId ?? null,
    });
    return { duplicate: false };
  } catch (error: any) {
    if (error?.code === 11000) {
      return { duplicate: true };
    }
    throw error;
  }
}

export async function attachBillingWebhookEventUser(eventId: string, clerkUserId: string) {
  await ensureDatabase();
  await BillingWebhookEvent.updateOne(
    { eventId, clerkUserId: null },
    { $set: { clerkUserId } }
  );
}

export async function buildAssistantMetadata(clerkUserId: string, chatId: string, webSearchUsed: boolean, sources: SourceRecord[]) {
  await ensureDatabase();
  const [user, chat] = await Promise.all([
    AppUser.findOne({ clerkUserId }).lean<any>(),
    findChatOrThrow(clerkUserId, chatId),
  ]);

  const memoryNotes = user?.memoryNotes?.trim() || "";
  const context = await getChatContext(clerkUserId, chatId);
  const contextUsed = [
    context.title ? `Chat title: ${context.title}` : "",
    context.summary ? `Conversation summary: ${context.summary}` : "",
    memoryNotes ? `User memory: ${memoryNotes}` : "",
    chat.systemPrompt?.trim() ? "Per-chat instructions applied" : "",
    webSearchUsed ? `Web search results: ${sources.length}` : "Web search disabled",
  ].filter(Boolean);

  return {
    memoryNotes,
    context,
    contextUsed,
    confidence: confidenceFromSources(sources, Boolean(chat.onlyFromSources)),
  };
}
