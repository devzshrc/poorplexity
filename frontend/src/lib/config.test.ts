import { describe, expect, test } from "bun:test";
import { parseBaseUrlCandidates, resolveApiBaseUrl } from "./config";

const localLocation = {
  hostname: "localhost",
  origin: "http://localhost:5173",
  protocol: "http:",
} as Location;

const productionLocation = {
  hostname: "poorplexity.app",
  origin: "https://poorplexity.app",
  protocol: "https:",
} as Location;

describe("api base url config", () => {
  test("parses comma-separated candidates", () => {
    expect(parseBaseUrlCandidates(" http://localhost:3598/ , https://api.example.com/ ")).toEqual([
      "http://localhost:3598",
      "https://api.example.com",
    ]);
  });

  test("prefers localhost while running locally", () => {
    expect(resolveApiBaseUrl("http://localhost:3598,https://api.example.com", localLocation)).toBe(
      "http://localhost:3598",
    );
  });

  test("prefers the deployed API while running from a deployed frontend", () => {
    expect(resolveApiBaseUrl("http://localhost:3598,https://api.example.com", productionLocation)).toBe(
      "https://api.example.com",
    );
  });

  test("does not choose an http API from an https frontend when another candidate exists", () => {
    expect(resolveApiBaseUrl("http://api.example.com,https://api.example.com", productionLocation)).toBe(
      "https://api.example.com",
    );
  });
});
