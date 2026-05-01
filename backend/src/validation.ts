import { z } from "zod";
import { badRequest } from "./errors";

const optionalNullableString = z.string().optional().nullable();

export const profilePatchSchema = z.object({
  displayName: z.string().optional(),
  imageUrl: z.string().optional(),
  bio: z.string().optional(),
  publicUsername: z.string().optional(),
}).strict();

export const preferencesPatchSchema = z.object({
  roastLevel: z.enum(["light", "medium", "high"]).optional(),
  responseLength: z.enum(["short", "medium", "long"]).optional(),
  outputFormat: z.enum(["bullets", "paragraphs"]).optional(),
  answerMode: z.enum(["fast", "balanced", "deep"]).optional(),
  preferredModel: z.string().optional(),
  onlyFromSources: z.boolean().optional(),
  defaultFolderId: optionalNullableString,
  memoryNotes: z.string().optional(),
  hideChatSettingsPanel: z.boolean().optional(),
}).strict();

export const subscribeCancelSchema = z.object({
  cancelAtCycleEnd: z.boolean().optional(),
}).strict();

export const billingVerifySchema = z.object({
  razorpay_payment_id: z.string().min(1).optional(),
  razorpay_subscription_id: z.string().min(1).optional(),
  razorpay_signature: z.string().min(1).optional(),
}).strict();

export const folderCreateSchema = z.object({
  name: z.string().optional(),
  parentFolderId: optionalNullableString,
}).strict();

export const folderPatchSchema = z.object({
  name: z.string().optional(),
  parentFolderId: optionalNullableString,
  isFavorite: z.boolean().optional(),
}).strict();

export const chatCreateSchema = z.object({
  title: z.string().optional(),
  folderId: optionalNullableString,
  firstMessage: z.string().optional(),
  branchFromChatId: optionalNullableString,
  branchFromMessageId: optionalNullableString,
}).strict();

export const chatPatchSchema = z.object({
  title: z.string().optional(),
  folderId: optionalNullableString,
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  systemPrompt: z.string().optional(),
  useWebSearch: z.boolean().optional(),
  answerMode: z.enum(["fast", "balanced", "deep"]).optional(),
  preferredModel: z.string().optional(),
  responseLength: z.enum(["short", "medium", "long"]).optional(),
  outputFormat: z.enum(["bullets", "paragraphs"]).optional(),
  roastLevel: z.enum(["light", "medium", "high"]).optional(),
  onlyFromSources: z.boolean().optional(),
  contextWindow: z.number().int().optional(),
}).strict();

export const archiveSchema = z.object({
  isArchived: z.boolean().optional(),
}).strict();

export const pinSchema = z.object({
  isPinned: z.boolean().optional(),
}).strict();

export const branchSchema = z.object({
  messageId: optionalNullableString,
}).strict();

export const editMessageSchema = z.object({
  messageId: z.string().min(1).optional(),
  content: z.string().optional(),
}).strict();

export const messageCreateSchema = z.object({
  content: z.string().optional(),
  useWebSearch: z.boolean().optional(),
}).strict();

export async function readJson<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest("Invalid request body", parsed.error.flatten());
  }
  return parsed.data;
}
