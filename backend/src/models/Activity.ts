import mongoose, { Schema } from "mongoose";

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

export const Activity: mongoose.Model<any> =
  (mongoose.models.Activity as mongoose.Model<any> | undefined)
  || mongoose.model("Activity", activitySchema);
