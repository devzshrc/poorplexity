import mongoose, { Schema } from "mongoose";

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

export const Chat: mongoose.Model<any> =
  (mongoose.models.Chat as mongoose.Model<any> | undefined)
  || mongoose.model("Chat", chatSchema);
