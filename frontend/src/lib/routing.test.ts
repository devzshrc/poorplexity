import { describe, expect, test } from "bun:test";
import { parseRoute } from "./routing";

describe("parseRoute", () => {
  test("detects the Clerk OAuth callback route", () => {
    expect(parseRoute("/sso-callback")).toEqual({ kind: "sso-callback" });
  });

  test("detects public profile routes", () => {
    expect(parseRoute("/u/alice_123")).toEqual({ kind: "profile", username: "alice_123" });
  });
});
