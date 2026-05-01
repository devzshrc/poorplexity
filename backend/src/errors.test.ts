import { describe, expect, test } from "bun:test";
import { badRequest, errorToResponse, notFound, serviceUnavailable } from "./errors";

describe("errorToResponse", () => {
  test("serializes exposed application errors", () => {
    expect(errorToResponse(notFound("Chat not found"))).toEqual({
      status: 404,
      body: {
        error: "Chat not found",
        code: "NOT_FOUND",
      },
    });
  });

  test("preserves validation details", () => {
    expect(errorToResponse(badRequest("Invalid request body", { fieldErrors: { name: ["Required"] } }))).toEqual({
      status: 400,
      body: {
        error: "Invalid request body",
        code: "BAD_REQUEST",
        details: { fieldErrors: { name: ["Required"] } },
      },
    });
  });

  test("keeps internal details hidden for unexposed errors", () => {
    expect(errorToResponse(serviceUnavailable("Billing is not configured"))).toEqual({
      status: 503,
      body: {
        error: "Billing is not configured",
        code: "SERVICE_UNAVAILABLE",
      },
    });
    expect(errorToResponse(new Error("database password leaked"))).toEqual({
      status: 500,
      body: {
        error: "Internal server error",
        code: "INTERNAL",
      },
    });
  });
});
