import { Skeleton } from '@/components/ui/skeleton'
import { safeHostname } from '@/lib/format'
import type { Source } from '@/types/api'

function faviconUrl(url: string) {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?sz=32&domain=${host}`
  } catch {
    return ''
  }
}

export function CitationsSkeleton() {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="rounded-md border border-border bg-background/60 px-3 py-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="mt-2 h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function MessageSources({
  sources,
  onOpenSource,
}: {
  sources: Source[]
  onOpenSource?: (source: Source, index: number) => void
}) {
  if (!sources.length) return null
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {sources.slice(0, 6).map((source, idx) => {
        const fav = faviconUrl(source.url)
        return (
          <button
            key={source.url + idx}
            type="button"
            onClick={() => onOpenSource?.(source, idx + 1)}
            className="premium-surface flex gap-2 border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
          >
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-[10px] font-semibold text-muted-foreground">
              {fav ? <img src={fav} alt="" className="size-4" referrerPolicy="no-referrer" /> : idx + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block font-medium">{source.title || safeHostname(source.url)}</span>
              <span className="mt-1 block truncate text-muted-foreground">{safeHostname(source.url)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function CitationInline({
  source,
  index,
  onOpenSource,
}: {
  source: Source
  index: number
  onOpenSource?: (source: Source, index: number) => void
}) {
  return (
    <span className="group relative inline-block">
      <button
        type="button"
        onClick={() => onOpenSource?.(source, index)}
        className="mx-0.5 inline-flex size-4 items-center justify-center rounded-full bg-muted align-text-top text-[10px] font-semibold leading-none text-foreground/80 no-underline transition-colors hover:bg-foreground hover:text-background"
      >
        {index}
      </button>
      <span className="glass-soft pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-64 -translate-x-1/2 rounded-md border border-border p-3 text-left text-xs group-hover:block">
        <span className="flex items-center gap-2">
          {faviconUrl(source.url) ? (
            <img src={faviconUrl(source.url)} alt="" className="size-3.5" referrerPolicy="no-referrer" />
          ) : null}
          <span className="truncate text-muted-foreground">{safeHostname(source.url)}</span>
        </span>
        <span className="mt-1 block font-medium leading-snug">{source.title || safeHostname(source.url)}</span>
        {source.content ? (
          <span className="mt-1 block line-clamp-3 text-muted-foreground">{source.content}</span>
        ) : null}
      </span>
    </span>
  )
}

export function preprocessCitations(text: string, sourceCount: number) {
  if (!sourceCount || !text) return text
  const parts = text.split(/(```[\s\S]*?```|`[^`]*`)/g)
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part
      return part.replace(/\[(\d+)\]/g, (match, n) => {
        const idx = Number(n)
        if (idx >= 1 && idx <= sourceCount) return `[${idx}](cite-${idx})`
        return match
      })
    })
    .join('')
}
