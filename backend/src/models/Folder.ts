import mongoose, { Schema } from "mongoose";

const folderSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: "ChatFolder", default: null, index: true },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ChatFolder: mongoose.Model<any> =
  (mongoose.models.ChatFolder as mongoose.Model<any> | undefined)
  || mongoose.model("ChatFolder", folderSchema);
