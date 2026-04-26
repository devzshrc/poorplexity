function normalizeBaseUrl(raw: string): string {
  const candidate = raw
    .split(",")
    .map((value) => value.trim())
    .find(Boolean) ?? "";

  return candidate.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3598"
);
