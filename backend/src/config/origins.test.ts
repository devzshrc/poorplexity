import { describe, expect, test } from "bun:test";
import { normalizeOrigin, parseAllowedOrigins } from "./origins";

describe("origin config", () => {
  test("normalizes origin lists for CORS and Clerk authorized parties", () => {
    expect(parseAllowedOrigins(" https://app.example.com/ , http://localhost:5173/ ")).toEqual([
      "https://app.example.com",
      "http://localhost:5173",
    ]);
  });

  test("deduplicates origins and strips paths", () => {
    expect(parseAllowedOrigins("https://app.example.com/a,https://app.example.com/b")).toEqual([
      "https://app.example.com",
    ]);
  });

  test("keeps invalid origins as trimmed values", () => {
    expect(normalizeOrigin(" chrome-extension://abc/ ")).toBe("chrome-extension://abc");
  });
});
