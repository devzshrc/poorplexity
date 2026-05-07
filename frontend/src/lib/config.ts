type RuntimeLocation = Pick<Location, 'hostname' | 'origin' | 'protocol'>

export function parseBaseUrlCandidates(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/\/+$/, ""))
}

function getRuntimeLocation(): RuntimeLocation | undefined {
  return typeof window === "undefined" ? undefined : window.location
}

function getHostname(candidate: string, location: RuntimeLocation | undefined): string | null {
  try {
    return new URL(candidate, location?.origin ?? "http://localhost").hostname
  } catch {
    return null
  }
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname.endsWith(".localhost")
}

function isLocalCandidate(candidate: string, location: RuntimeLocation | undefined): boolean {
  const hostname = getHostname(candidate, location)
  return hostname ? isLocalHostname(hostname) : false
}

function avoidsMixedContent(candidate: string, location: RuntimeLocation | undefined): boolean {
  if (location?.protocol !== "https:") return true

  try {
    return new URL(candidate, location.origin).protocol !== "http:"
  } catch {
    return false
  }
}

export function resolveApiBaseUrl(
  raw: string,
  location = getRuntimeLocation(),
  fallback = "http://localhost:3598",
): string {
  const candidates = parseBaseUrlCandidates(raw || fallback)
  const safeCandidates = candidates.filter((candidate) => avoidsMixedContent(candidate, location))
  const selectableCandidates = safeCandidates.length > 0 ? safeCandidates : candidates
  const localRuntime = location ? isLocalHostname(location.hostname) : true

  const preferred = selectableCandidates.find((candidate) => {
    const localCandidate = isLocalCandidate(candidate, location)
    return localRuntime ? localCandidate : !localCandidate
  })

  return preferred ?? selectableCandidates[0] ?? ""
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL || "")
