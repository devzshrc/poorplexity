import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertCircle, ArrowRight, ArrowUpRight, Loader2, LogOut } from 'lucide-react'

import { Button }                              from '@/components/ui/button'
import { Input }                               from '@/components/ui/input'
import { Card, CardHeader, CardTitle,
         CardDescription, CardContent }        from '@/components/ui/card'
import { Skeleton }                            from '@/components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Separator }                           from '@/components/ui/separator'
import { LoginPage }                           from '@/components/LoginPage'
import { useAuth }                             from '@/providers/AuthProvider'
import { signOut }                             from '@/lib/auth-client'
import { API_BASE_URL }                        from '@/lib/config'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Source { url: string; title: string; content: string }
type AppState = 'idle' | 'loading' | 'streaming' | 'done' | 'error'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function faviconUrl(url: string) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32` }
  catch { return '' }
}

// ─── SSE consumer ─────────────────────────────────────────────────────────────

type SSEHandler = {
  onSources:   (s: Source[]) => void
  onAnswer:    (chunk: string) => void
  onFollowUps: (qs: string[]) => void
  onDone:      () => void
  onError:     (msg: string) => void
}

async function consumeStream(res: Response, h: SSEHandler, signal: AbortSignal) {
  const reader  = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const lines  = part.trim().split('\n')
        const evLine = lines.find(l => l.startsWith('event:'))
        const dtLine = lines.find(l => l.startsWith('data:'))
        if (!evLine || !dtLine) continue

        const event = evLine.slice(6).trim()
        let data: unknown
        try { data = JSON.parse(dtLine.slice(5).trim()) } catch { continue }

        if      (event === 'sources')   h.onSources(data as Source[])
        else if (event === 'answer')    h.onAnswer(data as string)
        else if (event === 'followUps') h.onFollowUps(data as string[])
        else if (event === 'done')      h.onDone()
        else if (event === 'error')     h.onError((data as { message: string }).message)
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!signal.aborted) h.onDone()
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-3">
      {children}
    </p>
  )
}

// ─── Source skeleton ──────────────────────────────────────────────────────────

function SourceSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-3 gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </Card>
      ))}
    </div>
  )
}

// ─── Answer skeleton ──────────────────────────────────────────────────────────

function AnswerSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {['95%', '82%', '91%', '68%', '78%'].map((w, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: w }} />
      ))}
    </div>
  )
}

// ─── Main search view ─────────────────────────────────────────────────────────

function SearchView() {
  const { session } = useAuth()

  const [query,     setQuery]     = useState('')
  const [state,     setState]     = useState<AppState>('idle')
  const [answer,    setAnswer]    = useState('')
  const [sources,   setSources]   = useState<Source[]>([])
  const [followUps, setFollowUps] = useState<string[]>([])
  const [errorMsg,  setErrorMsg]  = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const search = async (q: string) => {
    if (!q.trim()) return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setAnswer('')
    setSources([])
    setFollowUps([])
    setErrorMsg('')
    setState('loading')

    try {
      const res = await fetch(`${API_BASE_URL}/conversation`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ query: q }),
        signal:      ctrl.signal,
        credentials: 'include',
      })

      if (res.status === 401) {
        // Session expired — reload to trigger auth gate
        window.location.reload()
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setErrorMsg((err as { error?: string }).error ?? `HTTP ${res.status}`)
        setState('error')
        return
      }
      if (!res.body) { setErrorMsg('Empty response from server.'); setState('error'); return }

      setState('streaming')

      await consumeStream(res, {
        onSources:   (s)   => setSources(s),
        onAnswer:    (c)   => setAnswer(prev => prev + c),
        onFollowUps: (qs)  => setFollowUps(qs),
        onDone:      ()    => setState(p => p === 'error' ? p : 'done'),
        onError:     (msg) => { setErrorMsg(msg); setState('error') },
      }, ctrl.signal)

    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return
      setErrorMsg((e as Error).message ?? 'Connection failed.')
      setState('error')
    }
  }

  const handleSubmit  = (e: React.FormEvent) => { e.preventDefault(); search(query) }
  const handleFollowUp = (q: string) => { setQuery(q); search(q) }

  const isSearching = state === 'loading' || state === 'streaming'
  const hasResults  = state !== 'idle'

  // ── Search bar ────────────────────────────────────────────────────────────

  const SearchBar = (
    <form onSubmit={handleSubmit} className="flex gap-0">
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Ask anything…"
        disabled={isSearching}
        autoFocus
        className="rounded-none border-r-0 h-11 text-base focus-visible:ring-0 focus-visible:border-border"
      />
      <Button
        type="submit"
        disabled={isSearching}
        className="rounded-none h-11 px-5 shrink-0"
      >
        {isSearching
          ? <Loader2 className="size-4 animate-spin" />
          : <ArrowRight className="size-4" />
        }
      </Button>
    </form>
  )

  // ── Idle / hero ───────────────────────────────────────────────────────────

  if (!hasResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">poorplexity</h1>
            <p className="text-sm text-muted-foreground mt-1">Search the web. Get real answers.</p>
          </div>
          {SearchBar}
        </div>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight">poorplexity</h1>
            <div className="flex items-center gap-2">
              {session?.user.image && (
                <img src={session.user.image} alt="" className="size-6 rounded-full" />
              )}
              <span className="text-xs text-muted-foreground hidden sm:block">
                {session?.user.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => signOut()}
                title="Sign out"
              >
                <LogOut className="size-3.5" />
              </Button>
            </div>
          </div>
          {SearchBar}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8 pb-20">

        {/* Error */}
        {state === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMsg || 'Something went wrong. Please try again.'}</AlertDescription>
          </Alert>
        )}

        {/* Sources */}
        {(sources.length > 0 || state === 'loading') && (
          <section>
            <SectionLabel>Sources</SectionLabel>
            {state === 'loading' && sources.length === 0
              ? <SourceSkeletons />
              : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="group block">
                      <Card className="h-full transition-colors hover:border-foreground/30 gap-2 py-3">
                        <CardHeader className="px-3 py-0">
                          <div className="flex items-center justify-between">
                            <img
                              src={faviconUrl(s.url)}
                              alt=""
                              className="size-4 shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            <ArrowUpRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-0 flex flex-col gap-1">
                          <CardTitle className="text-xs leading-snug line-clamp-2">
                            {s.title || safeHostname(s.url)}
                          </CardTitle>
                          <CardDescription className="text-[10px] truncate">
                            {i + 1} · {safeHostname(s.url)}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
                </div>
              )
            }
          </section>
        )}

        {/* Answer */}
        {(answer || state === 'loading' || state === 'streaming') && (
          <section>
            <SectionLabel>Answer</SectionLabel>
            {!answer
              ? <AnswerSkeleton />
              : (
                <div className="prose-answer">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                  {state === 'streaming' && (
                    <span className="inline-block w-0.5 h-[14px] bg-foreground ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
                  )}
                </div>
              )
            }
          </section>
        )}

        {/* Follow-ups */}
        {followUps.length > 0 && (
          <section>
            <SectionLabel>Follow-ups</SectionLabel>
            <div className="flex flex-col">
              {followUps.map((q, i) => (
                <div key={i}>
                  {i === 0 && <Separator />}
                  <button
                    onClick={() => handleFollowUp(q)}
                    disabled={isSearching}
                    className="w-full flex items-center gap-3 py-3 text-sm text-left text-foreground hover:text-muted-foreground disabled:text-muted-foreground transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="size-3.5 text-muted-foreground shrink-0" />
                    {q}
                  </button>
                  <Separator />
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { session, isPending } = useAuth()

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return <SearchView />
}
