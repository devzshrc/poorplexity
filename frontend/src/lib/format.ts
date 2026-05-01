export function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function confidenceLabel(value?: number) {
  if (typeof value !== 'number') return null
  if (value >= 0.8) return 'High confidence'
  if (value >= 0.6) return 'Medium confidence'
  return 'Low confidence'
}

export function moneyLabel(amountPaise?: number | null, currency?: string | null) {
  if (typeof amountPaise !== 'number' || !currency) return null
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

export function dailyLimitLabel(limit: number | null) {
  return limit === null ? 'Unlimited' : `${limit}/day`
}

export function safeHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

export function normalizeTopicLabel(label: string) {
  return label
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
