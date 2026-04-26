function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3598"
);
