import { describe, expect, test } from "bun:test";
import { chatPatchSchema, messageCreateSchema, preferencesPatchSchema } from "./validation";

describe("request validation schemas", () => {
  test("rejects unknown preference keys", () => {
    const result = preferencesPatchSchema.safeParse({
      answerMode: "deep",
      admin: true,
    });

    expect(result.success).toBe(false);
  });

  test("accepts explicit web search override", () => {
    expect(messageCreateSchema.parse({
      content: "hello",
      useWebSearch: false,
    })).toEqual({
      content: "hello",
      useWebSearch: false,
    });
  });

  test("requires numeric context window in chat settings", () => {
    expect(chatPatchSchema.safeParse({ contextWindow: "12" }).success).toBe(false);
    expect(chatPatchSchema.safeParse({ contextWindow: 12 }).success).toBe(true);
  });
});
