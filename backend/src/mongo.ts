import mongoose, { Schema, Types } from "mongoose";
import type { User } from "@clerk/backend";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB_NAME?.trim() || "poorplexity";

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
  sources?: SourceRecord[];
  followUps?: string[];
};

type FolderDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  name: string;
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
  imageUrl: string | null;
  customImageUrl?: string | null;
  bio?: string | null;
};

type ChatDocument = {
  _id: Types.ObjectId;
  clerkUserId: string;
  folderId: Types.ObjectId | null;
  title: string;
  messages: MessageDocument[];
  lastMessageAt: Date;
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
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, required: true },
    sources: { type: [sourceSchema], default: undefined },
    followUps: { type: [String], default: undefined },
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
    imageUrl: { type: String, default: null },
    customImageUrl: { type: String, default: null },
    bio: { type: String, default: null },
    lastSignInAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const folderSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
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
  },
  { timestamps: true }
);

chatSchema.index({ clerkUserId: 1, updatedAt: -1 });

const activitySchema = new Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    entityType: {
      type: String,
      enum: ["chat", "folder", "message", "workspace"],
      required: true,
    },
    entityId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const AppUser: mongoose.Model<AppUserDocument> =
  (mongoose.models.AppUser as mongoose.Model<AppUserDocument> | undefined)
  || mongoose.model<AppUserDocument>("AppUser", appUserSchema);
const ChatFolder: mongoose.Model<FolderDocument> =
  (mongoose.models.ChatFolder as mongoose.Model<FolderDocument> | undefined)
  || mongoose.model<FolderDocument>("ChatFolder", folderSchema);
const Chat: mongoose.Model<ChatDocument> =
  (mongoose.models.Chat as mongoose.Model<ChatDocument> | undefined)
  || mongoose.model<ChatDocument>("Chat", chatSchema);
const Activity: mongoose.Model<ActivityDocument> =
  (mongoose.models.Activity as mongoose.Model<ActivityDocument> | undefined)
  || mongoose.model<ActivityDocument>("Activity", activitySchema);

function serializeUserProfile(user: {
  _id: Types.ObjectId;
  clerkUserId: string;
  displayName: string;
  email: string | null;
  imageUrl: string | null;
  bio?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): UserProfileRecord {
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
  };
}

export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: SourceRecord[];
  followUps?: string[];
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

function makeChatTitle(input: string): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (!compact) return "Untitled chat";
  const sentence = compact.split(/[.!?]/)[0]?.trim() || compact;
  return sentence.length <= 60 ? sentence : `${sentence.slice(0, 57).trim()}...`;
}

function serializeMessage(message: {
  _id?: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  sources?: SourceRecord[];
  followUps?: string[];
}): ChatMessageRecord {
  return {
    id: String(message._id),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    ...(message.sources?.length ? { sources: message.sources } : {}),
    ...(message.followUps?.length ? { followUps: message.followUps } : {}),
  };
}

function serializeChatSummary(chat: {
  _id: Types.ObjectId;
  title: string;
  folderId: Types.ObjectId | null;
  updatedAt: Date;
  lastMessageAt: Date;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const lastMessage = chat.messages.at(-1);
  return {
    id: String(chat._id),
    title: chat.title,
    folderId: chat.folderId ? String(chat.folderId) : null,
    updatedAt: chat.updatedAt.toISOString(),
    lastMessageAt: chat.lastMessageAt.toISOString(),
    lastMessagePreview: lastMessage?.content?.slice(0, 140) ?? "",
    lastMessageRole: lastMessage?.role ?? null,
    messageCount: chat.messages.length,
  };
}

function serializeFolder(folder: FolderDocument) {
  return {
    id: String(folder._id),
    name: folder.name,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export async function ensureDatabase() {
  await getMongoose();
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
      },
    },
    { upsert: true, new: true, lean: true }
  ) as AppUserDocument | null;

  if (!syncedUser) {
    throw new Error("Unable to synchronize user profile");
  }

  const effectiveUser = {
    ...syncedUser,
    displayName: syncedUser.customDisplayName?.trim() || syncedUser.displayName,
    imageUrl: syncedUser.customImageUrl?.trim() || syncedUser.imageUrl,
  };

  return serializeUserProfile(effectiveUser);
}

export async function getWorkspace(clerkUserId: string) {
  await ensureDatabase();

  const [folders, chats] = await Promise.all([
    ChatFolder.find({ clerkUserId }).sort({ name: 1 }).lean(),
    Chat.find({ clerkUserId }).sort({ lastMessageAt: -1 }).lean(),
  ]);

  return {
    folders: folders.map(serializeFolder),
    chats: chats.map(serializeChatSummary),
  };
}

export async function updateUserProfile(
  clerkUserId: string,
  profile: {
    displayName?: string;
    imageUrl?: string;
    bio?: string;
  }
) {
  await ensureDatabase();

  const patch: Record<string, unknown> = {};

  if (profile.displayName !== undefined) {
    const trimmed = profile.displayName.trim();
    patch.customDisplayName = trimmed || null;
  }

  if (profile.imageUrl !== undefined) {
    const trimmed = profile.imageUrl.trim();
    patch.customImageUrl = trimmed || null;
  }

  if (profile.bio !== undefined) {
    const trimmed = profile.bio.trim();
    patch.bio = trimmed || null;
  }

  const user = await AppUser.findOneAndUpdate(
    { clerkUserId },
    { $set: patch },
    { new: true, lean: true }
  ) as AppUserDocument | null;

  if (!user) throw new Error("User not found");

  await recordActivity({
    clerkUserId,
    type: "user.profile.updated",
    entityType: "workspace",
    entityId: String(user._id),
    metadata: {
      ...(profile.displayName !== undefined ? { displayName: patch.customDisplayName } : {}),
      ...(profile.imageUrl !== undefined ? { imageUrl: patch.customImageUrl } : {}),
      ...(profile.bio !== undefined ? { bioLength: typeof patch.bio === "string" ? patch.bio.length : 0 } : {}),
    },
  });

  return serializeUserProfile({
    ...user,
    displayName: user.customDisplayName?.trim() || user.displayName,
    imageUrl: user.customImageUrl?.trim() || user.imageUrl,
  });
}

export async function deleteStoredUserData(clerkUserId: string) {
  await ensureDatabase();

  await Promise.all([
    Chat.deleteMany({ clerkUserId }),
    ChatFolder.deleteMany({ clerkUserId }),
    Activity.deleteMany({ clerkUserId }),
    AppUser.deleteOne({ clerkUserId }),
  ]);
}

export async function createFolder(clerkUserId: string, name: string) {
  await ensureDatabase();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");
  const folder = await ChatFolder.create({ clerkUserId, name: trimmed });
  await recordActivity({
    clerkUserId,
    type: "folder.created",
    entityType: "folder",
    entityId: String(folder._id),
    metadata: { name: trimmed },
  });
  return serializeFolder(folder.toObject());
}

export async function renameFolder(clerkUserId: string, folderId: string, name: string) {
  await ensureDatabase();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");

  const folder = await ChatFolder.findOneAndUpdate(
    { _id: ensureObjectId(folderId), clerkUserId },
    { $set: { name: trimmed } },
    { new: true }
  ).lean();

  if (!folder) throw new Error("Folder not found");
  await recordActivity({
    clerkUserId,
    type: "folder.renamed",
    entityType: "folder",
    entityId: String(folder._id),
    metadata: { name: trimmed },
  });
  return serializeFolder(folder);
}

export async function deleteFolder(clerkUserId: string, folderId: string) {
  await ensureDatabase();
  const objectId = ensureObjectId(folderId);

  await Promise.all([
    Chat.updateMany({ clerkUserId, folderId: objectId }, { $set: { folderId: null } }),
    ChatFolder.deleteOne({ _id: objectId, clerkUserId }),
  ]);
  await recordActivity({
    clerkUserId,
    type: "folder.deleted",
    entityType: "folder",
    entityId: String(objectId),
  });
}

export async function createChat(params: {
  clerkUserId: string;
  folderId?: string | null;
  title?: string;
  firstMessage?: string;
}) {
  await ensureDatabase();

  const title = params.title?.trim() || makeChatTitle(params.firstMessage || "");
  const folderId = params.folderId ? ensureObjectId(params.folderId) : null;

  const chat = await Chat.create({
    clerkUserId: params.clerkUserId,
    folderId,
    title: title || "Untitled chat",
    messages: [],
    lastMessageAt: new Date(),
  });

  await recordActivity({
    clerkUserId: params.clerkUserId,
    type: "chat.created",
    entityType: "chat",
    entityId: String(chat._id),
    metadata: { folderId: folderId ? String(folderId) : null, title: chat.title },
  });

  return serializeChatSummary(chat.toObject());
}

export async function getChatDetail(clerkUserId: string, chatId: string) {
  await ensureDatabase();

  const chat = await Chat.findOne({
    _id: ensureObjectId(chatId),
    clerkUserId,
  }).lean();

  if (!chat) throw new Error("Chat not found");

  return {
    ...serializeChatSummary(chat),
    messages: chat.messages.map(serializeMessage),
  };
}

export async function updateChat(clerkUserId: string, chatId: string, updates: {
  title?: string;
  folderId?: string | null;
}) {
  await ensureDatabase();

  const patch: Record<string, unknown> = {};

  if (typeof updates.title === "string") {
    const trimmed = updates.title.trim();
    if (!trimmed) throw new Error("Chat title is required");
    patch.title = trimmed;
  }

  if (updates.folderId !== undefined) {
    patch.folderId = updates.folderId ? ensureObjectId(updates.folderId) : null;
  }

    const chat = await Chat.findOneAndUpdate(
    { _id: ensureObjectId(chatId), clerkUserId },
    { $set: patch },
    { new: true }
  ).lean();

  if (!chat) throw new Error("Chat not found");
  await recordActivity({
    clerkUserId,
    type: "chat.updated",
    entityType: "chat",
    entityId: String(chat._id),
    metadata: {
      ...(patch.title ? { title: patch.title } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId ? String(patch.folderId) : null } : {}),
    },
  });
  return serializeChatSummary(chat);
}

export async function deleteChat(clerkUserId: string, chatId: string) {
  await ensureDatabase();
  const objectId = ensureObjectId(chatId);
  await Chat.deleteOne({ _id: objectId, clerkUserId });
  await recordActivity({
    clerkUserId,
    type: "chat.deleted",
    entityType: "chat",
    entityId: String(objectId),
  });
}

export async function appendMessage(params: {
  clerkUserId: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ url: string; title: string; content: string }>;
  followUps?: string[];
}) {
  await ensureDatabase();

  const chat = await Chat.findOneAndUpdate(
    { _id: ensureObjectId(params.chatId), clerkUserId: params.clerkUserId },
    {
      $push: {
        messages: {
          role: params.role,
          content: params.content,
          ...(params.sources?.length ? { sources: params.sources } : {}),
          ...(params.followUps?.length ? { followUps: params.followUps } : {}),
          createdAt: new Date(),
        },
      },
      $set: {
        lastMessageAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  if (!chat) throw new Error("Chat not found");

  if (chat.messages.length === 1 && chat.title === "Untitled chat") {
    const title = makeChatTitle(params.content);
    await Chat.updateOne({ _id: chat._id }, { $set: { title } });
    chat.title = title;
  }

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

export async function getChatContext(clerkUserId: string, chatId: string, limit = 10) {
  await ensureDatabase();

  const chat = await Chat.findOne(
    { _id: ensureObjectId(chatId), clerkUserId },
    { title: 1, messages: { $slice: -limit } }
  ).lean();

  if (!chat) throw new Error("Chat not found");

  return {
    title: chat.title,
    messages: chat.messages.map((message: MessageDocument) => ({
      role: message.role,
      content: message.content,
    })),
  };
}
