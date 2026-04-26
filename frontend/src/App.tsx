import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ClerkLoaded, ClerkLoading, useAuth, useClerk } from '@clerk/react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Check,
  Download,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  Globe,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE_URL } from '@/lib/config'

type ThemeMode = 'light' | 'dark'
type RouteState = { kind: 'workspace' } | { kind: 'profile'; username: string }

type PreferenceRecord = {
  roastLevel: 'light' | 'medium' | 'high'
  responseLength: 'short' | 'medium' | 'long'
  outputFormat: 'bullets' | 'paragraphs'
  answerMode: 'fast' | 'balanced' | 'deep'
  preferredModel: string
  onlyFromSources: boolean
  defaultFolderId: string | null
  memoryNotes: string
  hideChatSettingsPanel: boolean
}

type BillingRecord = {
  tier: 'free' | 'premium'
  status: 'inactive' | 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired'
  isPremium: boolean
  planName: string | null
  dailyMessageLimit: number | null
  currentStart: string | null
  currentEnd: string | null
  renewsAt: string | null
  cancelAtCycleEnd: boolean
  amountPaise: number | null
  currency: string | null
  razorpaySubscriptionId: string | null
  shortUrl: string | null
  lastPaymentId: string | null
  lastWebhookEventId: string | null
  failureReason: string | null
}

type UsageActivity = {
  id: string
  type: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

type FolderRecord = {
  id: string
  name: string
  parentFolderId: string | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

type Source = {
  url: string
  title: string
  content: string
}

type ChatSettings = {
  systemPrompt: string
  useWebSearch: boolean
  answerMode: 'fast' | 'balanced' | 'deep'
  preferredModel: string
  responseLength: 'short' | 'medium' | 'long'
  outputFormat: 'bullets' | 'paragraphs'
  roastLevel: 'light' | 'medium' | 'high'
  onlyFromSources: boolean
  contextWindow: number
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  editedAt?: string | null
  sources?: Source[]
  followUps?: string[]
  contextUsed?: string[]
  confidence?: number
  webSearchUsed?: boolean
}

type ChatSummary = {
  id: string
  title: string
  folderId: string | null
  updatedAt: string
  lastMessageAt: string
  lastMessagePreview: string
  lastMessageRole: 'user' | 'assistant' | null
  messageCount: number
  isPinned: boolean
  isArchived: boolean
  branchFromChatId: string | null
  branchFromMessageId: string | null
}

type ChatDetail = ChatSummary & {
  settings: ChatSettings
  summary: string
  deletedAt: string | null
  restoreUntil: string | null
  messages: ChatMessage[]
}

type SearchResultPayload = {
  chats: ChatSummary[]
  messages: Array<ChatMessage & { chatId: string; chatTitle: string }>
}

type UsagePayload = {
  sentToday: number
  remainingToday: number | null
  dailyLimit: number | null
  deletedRecoverableCount: number
  activity: UsageActivity[]
}

type WorkspacePayload = {
  user: {
    id: string
    clerkUserId: string
    displayName: string
    email: string | null
    imageUrl: string | null
    bio: string | null
    firstName: string | null
    lastName: string | null
    username: string | null
    publicUsername?: string | null
    billing: BillingRecord
    preferences: PreferenceRecord
  }
  folders: FolderRecord[]
  chats: ChatSummary[]
  trash: ChatSummary[]
  usage: UsagePayload
}

type PublicProfilePayload = {
  profile: {
    displayName: string
    imageUrl: string | null
    bio: string
    publicUsername: string
  }
  stats: {
    totalChats: number
    archivedChats: number
    pinnedChats: number
    totalMessages: number
    userMessages: number
    assistantMessages: number
    folders: number
    activeDays: number
    sentToday: number
    averageMessagesPerChat: number
    averageUserMessageLength: number
  }
}

type BillingCheckoutPayload = {
  checkout: {
    key: string
    subscriptionId: string
    name: string
    description: string
    amountPaise: number | null
    currency: string | null
    prefill: {
      name: string
      email: string | null
    }
    theme: {
      color: string
    }
  }
  billing: BillingRecord
}

type SSEHandlers = {
  onSources: (sources: Source[]) => void
  onAnswer: (chunk: string) => void
  onFollowUps: (items: string[]) => void
  onChat: (chat: ChatSummary) => void
  onContext: (items: string[]) => void
  onConfidence: (value: number) => void
  onDone: () => void
  onError: (message: string) => void
}

type FilterValue = 'all' | 'unfiled' | 'archived' | 'trash' | string
type SortValue = 'recent' | 'title' | 'activity'
type MainView = 'chat' | 'settings'

const MODEL_OPTIONS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
] as const

const fadeUp = {
  initial: { opacity: 0, y: 14, scale: 0.992 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.994 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
}

const subtleList = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.015 } },
}

const fadeScale = {
  initial: { opacity: 0, scale: 0.97, y: 6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
}

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function confidenceLabel(value?: number) {
  if (typeof value !== 'number') return null
  if (value >= 0.8) return 'High confidence'
  if (value >= 0.6) return 'Medium confidence'
  return 'Low confidence'
}

function moneyLabel(amountPaise?: number | null, currency?: string | null) {
  if (typeof amountPaise !== 'number' || !currency) return null
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

function dailyLimitLabel(limit: number | null) {
  return limit === null ? 'Unlimited' : `${limit}/day`
}

function safeHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function parseRoute(pathname: string): RouteState {
  const match = pathname.match(/^\/u\/([a-zA-Z0-9_]+)$/)
  return match ? { kind: 'profile', username: match[1] } : { kind: 'workspace' }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string
      subscription_id: string
      name: string
      description: string
      handler: (response: {
        razorpay_payment_id: string
        razorpay_subscription_id: string
        razorpay_signature: string
      }) => void
      modal?: {
        ondismiss?: () => void
      }
      prefill?: {
        name?: string
        email?: string | null
      }
      theme?: {
        color?: string
      }
    }) => { open: () => void }
  }
}

async function loadRazorpayCheckout() {
  if (window.Razorpay) return window.Razorpay
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay Checkout')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'))
    document.head.appendChild(script)
  })

  if (!window.Razorpay) {
    throw new Error('Razorpay Checkout is unavailable')
  }
  return window.Razorpay
}

async function consumeStream(res: Response, handlers: SSEHandlers, signal: AbortSignal) {
  const reader = res.body!.getReader()
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
        const lines = part.trim().split('\n')
        const eventLine = lines.find((line) => line.startsWith('event:'))
        const dataLine = lines.find((line) => line.startsWith('data:'))
        if (!eventLine || !dataLine) continue
        const event = eventLine.slice(6).trim()
        let data: unknown
        try {
          data = JSON.parse(dataLine.slice(5).trim())
        } catch {
          continue
        }
        if (event === 'sources') handlers.onSources(data as Source[])
        else if (event === 'answer') handlers.onAnswer(data as string)
        else if (event === 'followUps') handlers.onFollowUps(data as string[])
        else if (event === 'chat') handlers.onChat(data as ChatSummary)
        else if (event === 'context') handlers.onContext(data as string[])
        else if (event === 'confidence') handlers.onConfidence(Number(data))
        else if (event === 'done') handlers.onDone()
        else if (event === 'error') handlers.onError((data as { message: string }).message)
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!signal.aborted) handlers.onDone()
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="h-9 w-9"
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function MessageSources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null
  return (
    <motion.div
      variants={subtleList}
      initial={false}
      animate="animate"
      className="mt-4 grid gap-2 sm:grid-cols-2"
    >
      {sources.slice(0, 6).map((source) => (
        <motion.a
          variants={fadeUp}
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="premium-surface border border-border px-3 py-2 text-xs transition-colors hover:-translate-y-px hover:bg-muted"
        >
          <div className="line-clamp-2 font-medium">{source.title || safeHostname(source.url)}</div>
          <div className="mt-1 truncate text-muted-foreground">{safeHostname(source.url)}</div>
        </motion.a>
      ))}
    </motion.div>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="h-dvh overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-3xl bg-card/70 p-4 shadow-sm">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-3 h-9 w-full" />
          <Skeleton className="mt-6 h-20 w-full" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
        <div className="rounded-3xl bg-card/70 p-5 shadow-sm">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-24 w-full" />
          <Skeleton className="mt-4 h-24 w-4/5" />
          <Skeleton className="mt-8 h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

function AuthOverlay({
  isOpen,
  onClose,
  onSignIn,
  onSignUp,
}: {
  isOpen: boolean
  onClose: () => void
  onSignIn: () => void
  onSignUp: () => void
}) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          {...fadeUp}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
        >
          <motion.div {...fadeUp} className="w-full max-w-sm">
            <Card className="premium-surface w-full shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">Sign in to send</CardTitle>
                <CardDescription>
                  Read the workspace freely. Sign in only when you want to send, save, branch, export, or keep history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="h-10 w-full justify-center" onClick={onSignIn}>
                  <LogIn className="mr-2 size-4" />
                  Sign in
                </Button>
                <Button variant="outline" className="h-10 w-full justify-center" onClick={onSignUp}>
                  <UserRound className="mr-2 size-4" />
                  Create account
                </Button>
                <Button variant="ghost" className="w-full justify-center" onClick={onClose}>
                  Close
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function PublicProfilePage({
  username,
  theme,
  onBack,
  onToggleTheme,
}: {
  username: string
  theme: ThemeMode
  onBack: () => void
  onToggleTheme: () => void
}) {
  const [profile, setProfile] = useState<PublicProfilePayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/api/public-profile/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
        return await res.json() as PublicProfilePayload
      })
      .then((payload) => {
        setProfile(payload)
        setError('')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [username])

  return (
    <div className="min-h-screen bg-background px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-card/80 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon-sm" onClick={onBack} title="Back to workspace">
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="text-sm font-medium">Public profile</div>
              <div className="text-xs text-muted-foreground">@{username}</div>
            </div>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>

        {loading ? (
          <WorkspaceSkeleton />
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Profile unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : profile ? (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="shadow-none">
              <CardHeader>
                <div className="flex items-center gap-4">
                  {profile.profile.imageUrl ? (
                    <img src={profile.profile.imageUrl} alt="" className="size-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-lg font-semibold">
                      {profile.profile.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <CardTitle className="truncate">{profile.profile.displayName}</CardTitle>
                    <CardDescription>@{profile.profile.publicUsername}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {profile.profile.bio || 'No bio set yet.'}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Total chats', profile.stats.totalChats],
                  ['Total messages', profile.stats.totalMessages],
                  ['Active days', profile.stats.activeDays],
                  ['Pinned chats', profile.stats.pinnedChats],
                  ['Archived chats', profile.stats.archivedChats],
                  ['Avg messages/chat', profile.stats.averageMessagesPerChat],
                  ['Avg user msg length', profile.stats.averageUserMessageLength],
                  ['Folders', profile.stats.folders],
                  ['Sent today', profile.stats.sentToday],
                ].map(([label, value]) => (
                  <Card key={String(label)} className="shadow-none">
                    <CardHeader className="pb-2">
                      <CardDescription>{label}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Analytics snapshot</CardTitle>
                  <CardDescription>Platform-visible summary stats for this user’s workspace activity.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>User vs assistant messages</span>
                    <span>{profile.stats.userMessages} / {profile.stats.assistantMessages}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>Organization density</span>
                    <span>{profile.stats.folders} folders</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Archival behavior</span>
                    <span>{profile.stats.archivedChats} archived</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PublicWorkspace({
  theme,
  onToggleTheme,
}: {
  theme: ThemeMode
  onToggleTheme: () => void
}) {
  const clerk = useClerk()
  const [composer, setComposer] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [examples] = useState([
    'Compare the latest M4 MacBook Air with comparable Windows ultrabooks.',
    'Explain bun vs node for production APIs with tradeoffs.',
    'Summarize the strongest arguments for and against nuclear power.',
  ])

  const openAuth = () => {
    window.localStorage.setItem('poorplexity-pending-draft', composer.trim())
    setShowAuth(true)
  }

  const redirectUrl = typeof window === 'undefined' ? '/' : window.location.origin

  return (
    <div className="relative h-dvh overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-3xl bg-card/75 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">poorplexity</h1>
              <p className="text-xs text-muted-foreground">Public workspace preview</p>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
          <div className="space-y-3 p-4">
            <Button className="h-10 justify-start" variant="outline" title="Create a chat after signing in">
              <Plus className="mr-2 size-4" />
              New chat
            </Button>
            <div className="rounded-2xl bg-background/60 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Try these</div>
              <div className="space-y-2">
                {examples.map((item) => (
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.995 }}
                    key={item}
                    onClick={() => setComposer(item)}
                    className="premium-surface w-full border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    {item}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col rounded-3xl bg-card/75 shadow-sm backdrop-blur-sm">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Ask first. Sign in when it matters.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can explore the workspace before login. Sending a message opens the minimal auth prompt.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button className="h-10" variant="outline" onClick={() => clerk.redirectToSignIn({ signInFallbackRedirectUrl: redirectUrl })}>
                  Sign in
                </Button>
                <Button className="h-10" onClick={() => clerk.redirectToSignUp({ signUpFallbackRedirectUrl: redirectUrl })}>
                  Create account
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <motion.div variants={subtleList} initial={false} animate="animate" className="mx-auto flex max-w-4xl flex-col gap-5">
              <motion.div {...fadeUp}>
              <Card className="premium-surface shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">What the product does</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>Continuous chat with context controls</span>
                    <Badge variant="outline">Live</Badge>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>Branching, regenerate, export, archive, restore</span>
                    <Badge variant="outline">Live</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Public profile with analytics by username</span>
                    <Badge variant="outline">Live</Badge>
                  </div>
                </CardContent>
              </Card>
              </motion.div>

              <motion.section {...fadeUp} className="premium-surface rounded-3xl bg-background/70 px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Assistant</Badge>
                  <span className="text-xs text-muted-foreground">Preview</span>
                </div>
                <div className="prose-answer">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {'- Answers can be short or detailed.\n- Web search can be toggled per message.\n- Sources and injected context are visible instead of being hidden behind product theater.'}
                  </ReactMarkdown>
                </div>
              </motion.section>
            </motion.div>
          </div>

          <div className="px-5 py-4">
            <div className="mx-auto max-w-4xl">
              <Textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (composer.trim()) openAuth()
                  }
                }}
                placeholder="Write your question. Send will ask you to sign in."
                className="min-h-28"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Your draft will be preserved through sign-in.</p>
                <Button disabled={!composer.trim()} onClick={openAuth}>
                  <Send className="mr-2 size-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AuthOverlay
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSignIn={() => clerk.redirectToSignIn({ signInFallbackRedirectUrl: redirectUrl })}
        onSignUp={() => clerk.redirectToSignUp({ signUpFallbackRedirectUrl: redirectUrl })}
      />
    </div>
  )
}

function Workspace({
  theme,
  onToggleTheme,
  navigateToProfile,
}: {
  theme: ThemeMode
  onToggleTheme: () => void
  navigateToProfile: (username: string) => void
}) {
  const { getToken } = useAuth()
  const clerk = useClerk()
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null)
  const [chatCache, setChatCache] = useState<Record<string, ChatDetail>>({})
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all')
  const [sortBy, setSortBy] = useState<SortValue>('recent')
  const [composer, setComposer] = useState('')
  const [composerUseWebSearch, setComposerUseWebSearch] = useState(true)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderParentId, setFolderParentId] = useState<string>('root')
  const [isBooting, setIsBooting] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const [showFolderCreator, setShowFolderCreator] = useState(false)
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null)
  const [isSavingChatSettings, setIsSavingChatSettings] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [mainView, setMainView] = useState<MainView>('chat')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResultPayload | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({ displayName: '', imageUrl: '', bio: '', publicUsername: '' })
  const [preferenceForm, setPreferenceForm] = useState<PreferenceRecord>({
    roastLevel: 'medium',
    responseLength: 'short',
    outputFormat: 'bullets',
    answerMode: 'fast',
    preferredModel: MODEL_OPTIONS[0],
    onlyFromSources: false,
    defaultFolderId: null,
    memoryNotes: '',
    hideChatSettingsPanel: false,
  })
  const [chatSettingsForm, setChatSettingsForm] = useState<ChatSettings>({
    systemPrompt: '',
    useWebSearch: true,
    answerMode: 'fast',
    preferredModel: MODEL_OPTIONS[0],
    responseLength: 'short',
    outputFormat: 'bullets',
    roastLevel: 'medium',
    onlyFromSources: false,
    contextWindow: 12,
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [showChatSettingsPanel, setShowChatSettingsPanel] = useState(true)
  const [isDeletingData, setIsDeletingData] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isStartingSubscription, setIsStartingSubscription] = useState(false)
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const authorizedFetch = async (path: string, init?: RequestInit) => {
    const token = await getToken()
    if (!token) throw new Error('Missing Clerk session token.')
    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    })
  }

  const loadWorkspace = async (preserveSelection = true) => {
    const res = await authorizedFetch('/api/workspace')
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as WorkspacePayload
    setWorkspace(payload)
    setSelectedChatId((current) => {
      if (preserveSelection && current && [...payload.chats, ...payload.trash].some((chat) => chat.id === current)) return current
      return payload.chats[0]?.id ?? null
    })
  }

  const loadChat = async (chatId: string) => {
    const res = await authorizedFetch(`/api/chats/${chatId}`)
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as { chat: ChatDetail }
    setChatCache((current) => ({ ...current, [chatId]: payload.chat }))
    return payload.chat
  }

  useEffect(() => {
    let cancelled = false
    setIsBooting(true)
    loadWorkspace(false)
      .catch((error: Error) => { if (!cancelled) setErrorMessage(error.message) })
      .finally(() => { if (!cancelled) setIsBooting(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const draft = window.localStorage.getItem('poorplexity-pending-draft')
    if (draft) {
      setComposer(draft)
      window.localStorage.removeItem('poorplexity-pending-draft')
    }
  }, [])

  useEffect(() => {
    if (!selectedChatId || chatCache[selectedChatId]) return
    loadChat(selectedChatId).catch((error: Error) => setErrorMessage(error.message))
  }, [selectedChatId, chatCache])

  useEffect(() => {
    setProfileForm({
      displayName: workspace?.user.displayName ?? '',
      imageUrl: workspace?.user.imageUrl ?? '',
      bio: workspace?.user.bio ?? '',
      publicUsername: workspace?.user.publicUsername ?? '',
    })
    if (workspace?.user.preferences) setPreferenceForm(clone(workspace.user.preferences))
  }, [workspace?.user])

  useEffect(() => {
    setShowChatSettingsPanel(!workspace?.user.preferences.hideChatSettingsPanel)
  }, [workspace?.user.preferences.hideChatSettingsPanel])

  useEffect(() => {
    const limitReached = workspace?.usage.remainingToday === 0 && !workspace?.user.billing.isPremium
    setShowUpgradePrompt(Boolean(limitReached))
  }, [workspace?.usage.remainingToday, workspace?.user.billing.isPremium])

  const folders = workspace?.folders ?? []
  const chats = workspace?.chats ?? []
  const trash = workspace?.trash ?? []
  const selectedChat = selectedChatId ? chatCache[selectedChatId] ?? null : null
  const currentFolderId = selectedChat?.folderId ?? null
  const userInitial = (workspace?.user.displayName || 'P').trim().charAt(0).toUpperCase()

  useEffect(() => {
    if (selectedChat?.settings) {
      setChatSettingsForm(clone(selectedChat.settings))
      setComposerUseWebSearch(selectedChat.settings.useWebSearch)
    }
  }, [selectedChat?.id, selectedChat?.settings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [selectedChatId, selectedChat?.messages.length])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    const timer = window.setTimeout(() => {
      authorizedFetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
          return await res.json() as SearchResultPayload
        })
        .then(setSearchResults)
        .catch((error: Error) => setErrorMessage(error.message))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const filteredChats = useMemo(() => {
    const base = activeFilter === 'trash'
      ? trash
      : activeFilter === 'archived'
        ? chats.filter((chat) => chat.isArchived)
        : chats.filter((chat) => {
            if (chat.isArchived) return false
            if (activeFilter === 'all') return true
            if (activeFilter === 'unfiled') return chat.folderId === null
            return chat.folderId === activeFilter
          })
    return [...base].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'activity') return b.messageCount - a.messageCount || +new Date(b.updatedAt) - +new Date(a.updatedAt)
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)
    })
  }, [activeFilter, chats, sortBy, trash])

  const groupedChatsCount = useMemo(() => {
    const next = new Map<string | null, number>()
    for (const chat of chats) next.set(chat.folderId, (next.get(chat.folderId) ?? 0) + 1)
    return next
  }, [chats])

  const createNewChat = async (branch?: { chatId: string; messageId?: string | null }) => {
    setIsCreatingChat(true)
    try {
      const res = await authorizedFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: activeFilter !== 'all' && activeFilter !== 'unfiled' && activeFilter !== 'archived' && activeFilter !== 'trash'
            ? activeFilter
            : preferenceForm.defaultFolderId,
          branchFromChatId: branch?.chatId ?? null,
          branchFromMessageId: branch?.messageId ?? null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
      const payload = await res.json() as { chat: ChatSummary }
      setWorkspace((current) => current ? { ...current, chats: [payload.chat, ...current.chats] } : current)
      setSelectedChatId(payload.chat.id)
      setMainView('chat')
      await loadChat(payload.chat.id)
      return payload.chat.id
    } finally {
      setIsCreatingChat(false)
    }
  }

  const patchFolder = async (folderId: string, body: Partial<Pick<FolderRecord, 'name' | 'parentFolderId' | 'isFavorite'>>) => {
    const res = await authorizedFetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as { folder: FolderRecord }
    setWorkspace((current) => current ? { ...current, folders: current.folders.map((folder) => folder.id === payload.folder.id ? payload.folder : folder) } : current)
  }

  const createFolder = async () => {
    setIsCreatingFolder(true)
    try {
      const res = await authorizedFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentFolderId: folderParentId === 'root' ? null : folderParentId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
      const payload = await res.json() as { folder: FolderRecord }
      setWorkspace((current) => current ? { ...current, folders: [...current.folders, payload.folder] } : current)
      setNewFolderName('')
      setFolderParentId('root')
      setShowFolderCreator(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const moveChatToFolder = async (folderId: string | null, chatId = selectedChatId) => {
    if (!chatId) return
    const res = await authorizedFetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as { chat: ChatSummary }
    setWorkspace((current) => current ? { ...current, chats: current.chats.map((chat) => chat.id === payload.chat.id ? payload.chat : chat) } : current)
    setChatCache((current) => current[chatId] ? { ...current, [chatId]: { ...current[chatId], folderId: payload.chat.folderId } } : current)
  }

  const archiveSelectedChat = async (isArchived: boolean) => {
    if (!selectedChatId) return
    const res = await authorizedFetch(`/api/chats/${selectedChatId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as { chat: ChatSummary }
    setWorkspace((current) => current ? { ...current, chats: current.chats.map((chat) => chat.id === payload.chat.id ? payload.chat : chat) } : current)
    setChatCache((current) => current[selectedChatId] ? { ...current, [selectedChatId]: { ...current[selectedChatId], isArchived } } : current)
  }

  const pinSelectedChat = async (isPinned: boolean) => {
    if (!selectedChatId) return
    const res = await authorizedFetch(`/api/chats/${selectedChatId}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as { chat: ChatSummary }
    setWorkspace((current) => current ? { ...current, chats: current.chats.map((chat) => chat.id === payload.chat.id ? payload.chat : chat) } : current)
    setChatCache((current) => current[selectedChatId] ? { ...current, [selectedChatId]: { ...current[selectedChatId], isPinned } } : current)
  }

  const softDeleteSelectedChat = async () => {
    if (!selectedChatId) return
    const res = await authorizedFetch(`/api/chats/${selectedChatId}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    await loadWorkspace(false)
    setSelectedChatId(null)
    setActiveFilter('trash')
  }

  const restoreDeletedChat = async (chatId: string) => {
    const res = await authorizedFetch(`/api/chats/${chatId}/restore`, { method: 'POST' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    await loadWorkspace(false)
    setActiveFilter('all')
  }

  const attachStreamToAssistant = async (res: Response, chatId: string, signal: AbortSignal) => {
    await consumeStream(res, {
      onSources: (sources) => {
        setChatCache((current) => {
          const chat = current[chatId]
          if (!chat) return current
          const messages = [...chat.messages]
          const last = messages.at(-1)
          if (!last || last.role !== 'assistant') return current
          messages[messages.length - 1] = { ...last, sources }
          return { ...current, [chatId]: { ...chat, messages } }
        })
      },
      onAnswer: (chunk) => {
        setChatCache((current) => {
          const chat = current[chatId]
          if (!chat) return current
          const messages = [...chat.messages]
          const last = messages.at(-1)
          if (!last || last.role !== 'assistant') return current
          messages[messages.length - 1] = { ...last, content: last.content + chunk }
          return { ...current, [chatId]: { ...chat, messages } }
        })
      },
      onFollowUps: (items) => {
        setChatCache((current) => {
          const chat = current[chatId]
          if (!chat) return current
          const messages = [...chat.messages]
          const last = messages.at(-1)
          if (!last || last.role !== 'assistant') return current
          messages[messages.length - 1] = { ...last, followUps: items }
          return { ...current, [chatId]: { ...chat, messages } }
        })
      },
      onChat: (chat) => setWorkspace((current) => current ? { ...current, chats: [chat, ...current.chats.filter((item) => item.id !== chat.id)] } : current),
      onContext: (items) => {
        setChatCache((current) => {
          const chat = current[chatId]
          if (!chat) return current
          const messages = [...chat.messages]
          const last = messages.at(-1)
          if (!last || last.role !== 'assistant') return current
          messages[messages.length - 1] = { ...last, contextUsed: items }
          return { ...current, [chatId]: { ...chat, messages } }
        })
      },
      onConfidence: (value) => {
        setChatCache((current) => {
          const chat = current[chatId]
          if (!chat) return current
          const messages = [...chat.messages]
          const last = messages.at(-1)
          if (!last || last.role !== 'assistant') return current
          messages[messages.length - 1] = { ...last, confidence: value }
          return { ...current, [chatId]: { ...chat, messages } }
        })
      },
      onDone: () => {},
      onError: (message) => setErrorMessage(message),
    }, signal)
  }

  const sendMessage = async (seed?: string) => {
    const content = (seed ?? composer).trim()
    if (!content || isSending) return
    const previousComposer = composer
    let activeChatId: string | null = selectedChatId
    let optimisticIds: { user: string; assistant: string } | null = null
    setComposer('')
    setErrorMessage('')
    setIsSending(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      if (!activeChatId || activeFilter === 'trash') activeChatId = await createNewChat()
      if (!activeChatId) throw new Error('Unable to create a chat.')

      const now = new Date().toISOString()
      const optimisticUser: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content, createdAt: now }
      const optimisticAssistant: ChatMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: '', createdAt: now, contextUsed: [] }
      optimisticIds = { user: optimisticUser.id, assistant: optimisticAssistant.id }
      setChatCache((current) => {
        const previous = current[activeChatId!]
        if (!previous) return current
        return { ...current, [activeChatId!]: { ...previous, messages: [...previous.messages, optimisticUser, optimisticAssistant] } }
      })

      const res = await authorizedFetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, useWebSearch: composerUseWebSearch }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string; code?: string }
        if (payload.code === 'DAILY_LIMIT_REACHED') {
          setShowUpgradePrompt(true)
        }
        throw new Error(payload.error ?? `HTTP ${res.status}`)
      }
      await attachStreamToAssistant(res, activeChatId, controller.signal)
      await Promise.all([loadWorkspace(), loadChat(activeChatId)])
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setChatCache((current) => {
          const previous = activeChatId ? current[activeChatId] : null
          if (!previous || !optimisticIds || !activeChatId) return current
          return {
            ...current,
            [activeChatId]: {
              ...previous,
              messages: previous.messages.filter((message) => message.id !== optimisticIds!.user && message.id !== optimisticIds!.assistant),
            },
          }
        })
        setComposer(seed ? previousComposer : content)
        setErrorMessage(error instanceof Error ? error.message : String(error))
      }
    } finally {
      setIsSending(false)
      setEditingMessageId(null)
    }
  }

  const regenerateLastAnswer = async () => {
    if (!selectedChatId || isSending) return
    const res = await authorizedFetch(`/api/chats/${selectedChatId}/regenerate`, { method: 'POST' })
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    setIsSending(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await attachStreamToAssistant(res, selectedChatId, controller.signal)
      await Promise.all([loadWorkspace(), loadChat(selectedChatId)])
    } finally {
      setIsSending(false)
    }
  }

  const editAndResendMessage = async () => {
    if (!selectedChatId || !editingMessageId || !composer.trim()) return
    const res = await authorizedFetch(`/api/chats/${selectedChatId}/edit-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: editingMessageId, content: composer.trim() }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as { chat: ChatDetail }
    setChatCache((current) => ({ ...current, [selectedChatId]: payload.chat }))
    setComposer('')
    setEditingMessageId(null)
    await regenerateLastAnswer()
  }

  const branchFromMessage = async (messageId?: string | null) => {
    if (!selectedChatId) return
    const res = await authorizedFetch(`/api/chats/${selectedChatId}/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: messageId ?? null }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    const payload = await res.json() as { chat: ChatSummary }
    setWorkspace((current) => current ? { ...current, chats: [payload.chat, ...current.chats] } : current)
    setSelectedChatId(payload.chat.id)
    await loadChat(payload.chat.id)
  }

  const saveProfile = async () => {
    setIsSavingProfile(true)
    try {
      const res = await authorizedFetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
      const payload = await res.json() as { user: WorkspacePayload['user'] }
      setWorkspace((current) => current ? { ...current, user: payload.user } : current)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const savePreferences = async () => {
    setIsSavingPreferences(true)
    try {
      const res = await authorizedFetch('/api/settings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferenceForm),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
      const payload = await res.json() as { user: WorkspacePayload['user'] }
      setWorkspace((current) => current ? { ...current, user: payload.user } : current)
    } finally {
      setIsSavingPreferences(false)
    }
  }

  const saveChatSettings = async () => {
    if (!selectedChatId) return
    setIsSavingChatSettings(true)
    try {
      const res = await authorizedFetch(`/api/chats/${selectedChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatSettingsForm),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
      await loadChat(selectedChatId)
      if (!workspace?.user.preferences.hideChatSettingsPanel) {
        const prefRes = await authorizedFetch('/api/settings/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hideChatSettingsPanel: true }),
        })
        if (!prefRes.ok) throw new Error((await prefRes.json().catch(() => ({ error: `HTTP ${prefRes.status}` })) as { error?: string }).error ?? `HTTP ${prefRes.status}`)
        const prefPayload = await prefRes.json() as { user: WorkspacePayload['user'] }
        setWorkspace((current) => current ? { ...current, user: prefPayload.user } : current)
        setShowChatSettingsPanel(false)
      }
    } finally {
      setIsSavingChatSettings(false)
    }
  }

  const startPremiumCheckout = async () => {
    setIsStartingSubscription(true)
    setErrorMessage('')
    try {
      const Razorpay = await loadRazorpayCheckout()
      const res = await authorizedFetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = await res.json().catch(() => ({})) as BillingCheckoutPayload & { error?: string }
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`)

      setWorkspace((current) => current ? {
        ...current,
        user: {
          ...current.user,
          billing: payload.billing,
        },
      } : current)

      const checkout = new Razorpay({
        key: payload.checkout.key,
        subscription_id: payload.checkout.subscriptionId,
        name: payload.checkout.name,
        description: payload.checkout.description,
        prefill: payload.checkout.prefill,
        theme: payload.checkout.theme,
        handler: async (response) => {
          try {
            const verifyRes = await authorizedFetch('/api/billing/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            })
            const verifyPayload = await verifyRes.json().catch(() => ({})) as { billing?: BillingRecord; error?: string }
            if (!verifyRes.ok) throw new Error(verifyPayload.error ?? `HTTP ${verifyRes.status}`)

            setWorkspace((current) => current ? {
              ...current,
              user: {
                ...current.user,
                billing: verifyPayload.billing ?? current.user.billing,
              },
            } : current)
            await loadWorkspace()
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : String(error))
          }
        },
        modal: {
          ondismiss: () => {
            void loadWorkspace().catch((error: Error) => setErrorMessage(error.message))
          },
        },
      })

      checkout.open()
    } finally {
      setIsStartingSubscription(false)
    }
  }

  const cancelPremiumSubscription = async () => {
    setIsCancellingSubscription(true)
    setErrorMessage('')
    try {
      const res = await authorizedFetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtCycleEnd: true }),
      })
      const payload = await res.json().catch(() => ({})) as { billing?: BillingRecord; error?: string }
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`)
      setWorkspace((current) => current ? {
        ...current,
        user: {
          ...current.user,
          billing: payload.billing ?? current.user.billing,
        },
      } : current)
      await loadWorkspace()
    } finally {
      setIsCancellingSubscription(false)
    }
  }

  const exportStoredData = async () => {
    setIsExportingData(true)
    try {
      const res = await authorizedFetch('/api/settings/export')
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
      const payload = await res.json()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `poorplexity-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExportingData(false)
    }
  }

  const deleteStoredData = async () => {
    if (!window.confirm('Delete all stored data for this account?')) return
    setIsDeletingData(true)
    try {
      const res = await authorizedFetch('/api/settings/data', { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
      setChatCache({})
      setSelectedChatId(null)
      await loadWorkspace(false)
    } finally {
      setIsDeletingData(false)
    }
  }

  const exportChat = (format: 'markdown' | 'json' | 'pdf') => {
    if (!selectedChat) return
    const markdown = [
      `# ${selectedChat.title}`,
      '',
      selectedChat.summary ? `> ${selectedChat.summary}` : '',
      '',
      ...selectedChat.messages.flatMap((message) => [
        `## ${message.role === 'user' ? 'User' : 'Assistant'} · ${timeLabel(message.createdAt)}`,
        '',
        message.content,
        '',
      ]),
    ].filter(Boolean).join('\n')
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(selectedChat, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedChat.title.replace(/\W+/g, '-').toLowerCase() || 'chat'}.json`
      link.click()
      URL.revokeObjectURL(url)
      return
    }
    if (format === 'markdown') {
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedChat.title.replace(/\W+/g, '-').toLowerCase() || 'chat'}.md`
      link.click()
      URL.revokeObjectURL(url)
      return
    }
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
    if (!win) return
    win.document.write(`<pre style="white-space:pre-wrap;font-family:Inter,sans-serif;padding:24px;">${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`)
    win.document.close()
    win.focus()
    win.print()
  }

  if (isBooting) return <WorkspaceSkeleton />

  const visibleChats = filteredChats
  const foldersByParent = new Map<string | null, FolderRecord[]>()
  for (const folder of folders) {
    const key = folder.parentFolderId ?? null
    const list = foldersByParent.get(key) ?? []
    list.push(folder)
    foldersByParent.set(key, list)
  }
  for (const list of foldersByParent.values()) list.sort((a, b) => (a.isFavorite === b.isFavorite ? a.name.localeCompare(b.name) : a.isFavorite ? -1 : 1))

  const renderFolders = (parentId: string | null, depth = 0): ReactNode[] => {
    const list = foldersByParent.get(parentId) ?? []
    return list.flatMap((folder) => [
      <motion.div
        key={folder.id}
        {...fadeUp}
        className="space-y-1"
        style={{ paddingLeft: depth ? `${depth * 10}px` : undefined }}
      >
        <div className={joinClasses('premium-surface relative rounded-2xl bg-background/70 px-3 py-3 transition-colors hover:-translate-y-px', activeFilter === folder.id && 'bg-muted/60')}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => setActiveFilter(folder.id)}
              title={folder.name}
            >
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{folder.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {groupedChatsCount.get(folder.id) ?? 0} chats
                  {folder.parentFolderId ? ' • nested folder' : ''}
                </div>
              </div>
            </button>
            {folder.isFavorite ? <Star className="size-3.5 shrink-0 fill-current text-muted-foreground" /> : null}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              title="Folder tools"
              onClick={() => setOpenFolderMenuId((current) => current === folder.id ? null : folder.id)}
            >
              <MoreHorizontal className="mr-2 size-4" />
              Tools
            </Button>
          </div>
          <AnimatePresence>
          {openFolderMenuId === folder.id ? (
            <motion.div
              {...fadeUp}
              className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl bg-popover/95 p-1 shadow-lg backdrop-blur-sm"
            >
              {[
                {
                  key: 'favorite',
                  icon: Star,
                  label: folder.isFavorite ? 'Unfavorite folder' : 'Favorite folder',
                  description: 'Keep this folder easier to spot.',
                  action: () => patchFolder(folder.id, { isFavorite: !folder.isFavorite }),
                },
                {
                  key: 'rename',
                  icon: Pencil,
                  label: 'Rename folder',
                  description: 'Change the folder name.',
                  action: async () => {
                    const next = window.prompt('Rename folder', folder.name)?.trim()
                    if (next) await patchFolder(folder.id, { name: next })
                  },
                },
                {
                  key: 'delete',
                  icon: Trash2,
                  label: 'Delete folder',
                  description: 'Remove the folder and keep its chats unfiled.',
                  action: async () => {
                    const res = await authorizedFetch(`/api/folders/${folder.id}`, { method: 'DELETE' })
                    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
                    await loadWorkspace()
                  },
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      item.action().catch((error: Error) => setErrorMessage(error.message))
                      setOpenFolderMenuId(null)
                    }}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  </button>
                )
              })}
            </motion.div>
          ) : null}
          </AnimatePresence>
        </div>
      </motion.div>,
      ...renderFolders(folder.id, depth + 1),
    ])
  }

  return (
    <div className="h-dvh overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-3xl bg-card/75 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">poorplexity</h1>
              <p className="text-xs text-muted-foreground">Research workspace</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{userInitial}</div>
              <Button variant="ghost" size="icon-sm" title="Sign out" onClick={() => clerk.signOut({ redirectUrl: window.location.origin })}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-stretch gap-2">
              <Button className="h-10 flex-1 justify-start" disabled={isCreatingChat} onClick={() => createNewChat().catch((error: Error) => setErrorMessage(error.message))}>
                {isCreatingChat ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                New chat
              </Button>
              <Button
                variant={mainView === 'settings' ? 'secondary' : 'outline'}
                size="icon-sm"
                className="h-10 w-10 shrink-0"
                title="Settings"
                onClick={() => setMainView('settings')}
              >
                <Settings className="size-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search chats and messages" className="pl-9" />
              {searchQuery ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  title="Clear search"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Browse</div>
                <div className="text-xs text-muted-foreground">Switch views and sort chats.</div>
              </div>
              <Button variant={showFolderCreator ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFolderCreator((current) => !current)}>
                <FolderPlus className="mr-2 size-4" />
                {showFolderCreator ? 'Close' : 'New folder'}
              </Button>
            </div>
            {showFolderCreator ? (
              <div className="grid gap-2 rounded-2xl bg-background/65 p-3">
                <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Folder name (optional)" />
                <select className="h-9 border border-input bg-transparent px-3 text-sm" value={folderParentId} onChange={(event) => setFolderParentId(event.target.value)}>
                  <option value="root">Top level</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
                <Button variant="outline" disabled={isCreatingFolder} onClick={() => createFolder().then(() => setShowFolderCreator(false)).catch((error: Error) => setErrorMessage(error.message))}>
                  {isCreatingFolder ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FolderPlus className="mr-2 size-4" />}
                  Create folder
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">View</div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'unfiled', 'archived', 'trash'] as FilterValue[]).map((filter) => (
                  <Button key={filter} variant={activeFilter === filter ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveFilter(filter)} title={`Show ${filter} chats`}>
                    {filter === 'all' ? 'All' : filter === 'unfiled' ? 'Unfiled' : filter === 'archived' ? 'Archived' : `Trash (${workspace?.usage.deletedRecoverableCount ?? 0})`}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Sort chats</div>
              <div className="flex items-center gap-2">
                <Button variant={sortBy === 'recent' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSortBy('recent')}>Recent</Button>
                <Button variant={sortBy === 'title' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSortBy('title')}>Title</Button>
                <Button variant={sortBy === 'activity' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSortBy('activity')}>Activity</Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {searchQuery.trim() ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Chats</div>
                  <motion.div variants={subtleList} initial={false} animate="animate" className="space-y-2">
                  {(searchResults?.chats ?? []).map((chat) => (
                    <motion.button
                      variants={fadeUp}
                      key={chat.id}
                      onClick={() => { setSelectedChatId(chat.id); setMainView('chat') }}
                      className={joinClasses('premium-surface w-full rounded-2xl bg-background/70 px-3 py-2 text-left transition-colors hover:-translate-y-px hover:bg-muted', selectedChatId === chat.id && 'bg-muted')}
                    >
                      <div className="truncate text-sm font-medium">{chat.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{chat.lastMessagePreview}</div>
                    </motion.button>
                  ))}
                  </motion.div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Messages</div>
                  <motion.div variants={subtleList} initial={false} animate="animate" className="space-y-2">
                  {(searchResults?.messages ?? []).map((message) => (
                    <motion.button
                      variants={fadeUp}
                      key={`${message.chatId}-${message.id}`}
                      onClick={() => { setSelectedChatId(message.chatId); setMainView('chat') }}
                      className="premium-surface w-full rounded-2xl bg-background/70 px-3 py-2 text-left transition-colors hover:-translate-y-px hover:bg-muted"
                    >
                      <div className="text-xs font-medium">{message.chatTitle}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{message.content}</div>
                    </motion.button>
                  ))}
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {renderFolders(null)}
                <motion.div variants={subtleList} initial={false} animate="animate" className="space-y-2 pt-1">
                  {visibleChats.map((chat) => (
                    <motion.div
                      variants={fadeUp}
                      key={chat.id}
                    >
                      <button
                        draggable={activeFilter !== 'trash'}
                        onDragStart={(event: DragEvent<HTMLButtonElement>) => event.dataTransfer.setData('text/plain', chat.id)}
                        onClick={() => { setSelectedChatId(chat.id); setMainView('chat') }}
                        className={joinClasses('premium-surface w-full rounded-2xl bg-background/70 px-3 py-2 text-left transition-colors hover:-translate-y-px hover:bg-muted', selectedChatId === chat.id && 'bg-muted')}
                      >
                        <div className="flex items-start gap-2">
                          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-medium">{chat.title}</div>
                              {chat.isPinned ? <Pin className="size-3 text-muted-foreground" /> : null}
                              {chat.branchFromChatId ? <GitBranch className="size-3 text-muted-foreground" /> : null}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{chat.lastMessagePreview || 'No messages yet.'}</div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col rounded-3xl bg-card/75 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              {selectedChat ? (
                editingTitle ? (
                  <div className="flex gap-2">
                    <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="w-[280px]" />
                    <Button className="h-9 w-9 shrink-0" size="icon-sm" title="Save title" onClick={() => authorizedFetch(`/api/chats/${selectedChat.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draftTitle }) }).then(() => loadWorkspace()).then(() => loadChat(selectedChat.id)).then(() => setEditingTitle(false)).catch((error: Error) => setErrorMessage(error.message))}><Check className="size-4" /></Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-xl font-semibold tracking-tight">{selectedChat.title}</h2>
                      {selectedChat.isPinned ? <Badge variant="outline">Pinned</Badge> : null}
                      {selectedChat.isArchived ? <Badge variant="outline">Archived</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{selectedChat.messageCount} messages</span>
                      <span>•</span>
                      <span>Updated {timeLabel(selectedChat.updatedAt)}</span>
                      {currentFolderId ? <Badge variant="outline">{folders.find((folder) => folder.id === currentFolderId)?.name ?? 'Folder'}</Badge> : null}
                    </div>
                  </>
                )
              ) : (
                <>
                  <h2 className="text-xl font-semibold tracking-tight">Choose a chat</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Pick one from the sidebar or create a new one.</p>
                </>
              )}
            </div>

            {selectedChat ? (
              <div className="relative flex flex-wrap items-center gap-1">
                {!showChatSettingsPanel ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Show chat controls"
                    onClick={() => setShowChatSettingsPanel(true)}
                  >
                    <Settings className="mr-2 size-4" />
                    Controls
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  title="Open tools menu"
                  onClick={() => setShowToolsMenu((current) => !current)}
                >
                  <MoreHorizontal className="mr-2 size-4" />
                  Tools
                </Button>
                    <AnimatePresence>
                      {showToolsMenu ? (
                  <motion.div
                    {...fadeScale}
                    className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl bg-popover/95 p-1 shadow-lg backdrop-blur-sm"
                  >
                    {[
                      {
                        key: 'rename',
                        icon: Pencil,
                        label: 'Rename chat',
                        description: 'Change the chat title.',
                        action: () => { setDraftTitle(selectedChat.title); setEditingTitle(true); setShowToolsMenu(false) },
                      },
                      {
                        key: 'pin',
                        icon: Pin,
                        label: selectedChat.isPinned ? 'Unpin chat' : 'Pin chat',
                        description: 'Keep this chat near the top.',
                        action: () => { pinSelectedChat(!selectedChat.isPinned).catch((error: Error) => setErrorMessage(error.message)); setShowToolsMenu(false) },
                      },
                      {
                        key: 'archive',
                        icon: Archive,
                        label: selectedChat.isArchived ? 'Unarchive chat' : 'Archive chat',
                        description: 'Hide it from the main list without deleting it.',
                        action: () => { archiveSelectedChat(!selectedChat.isArchived).catch((error: Error) => setErrorMessage(error.message)); setShowToolsMenu(false) },
                      },
                      {
                        key: 'branch',
                        icon: GitBranch,
                        label: 'Branch chat',
                        description: 'Start a new chat from the current thread state.',
                        action: () => { branchFromMessage(selectedChat.messages.at(-1)?.id ?? null).catch((error: Error) => setErrorMessage(error.message)); setShowToolsMenu(false) },
                      },
                      {
                        key: 'regenerate',
                        icon: RotateCcw,
                        label: 'Regenerate answer',
                        description: 'Re-run the last assistant answer.',
                        action: () => { regenerateLastAnswer().catch((error: Error) => setErrorMessage(error.message)); setShowToolsMenu(false) },
                      },
                      {
                        key: 'markdown',
                        icon: FileText,
                        label: 'Export as Markdown',
                        description: 'Download this chat as a markdown file.',
                        action: () => { exportChat('markdown'); setShowToolsMenu(false) },
                      },
                      {
                        key: 'json',
                        icon: FileCode2,
                        label: 'Export as JSON',
                        description: 'Download the raw structured chat data.',
                        action: () => { exportChat('json'); setShowToolsMenu(false) },
                      },
                      {
                        key: 'pdf',
                        icon: Download,
                        label: 'Export as PDF',
                        description: 'Open a printable version for PDF export.',
                        action: () => { exportChat('pdf'); setShowToolsMenu(false) },
                      },
                      {
                        key: 'trash',
                        icon: Trash2,
                        label: 'Move to trash',
                        description: 'Soft-delete this chat with a restore window.',
                        action: () => { softDeleteSelectedChat().catch((error: Error) => setErrorMessage(error.message)); setShowToolsMenu(false) },
                      },
                    ].map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={item.action}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted"
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          </div>
                        </button>
                      )
                    })}
                  </motion.div>
                ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="px-5 pt-4">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Something broke</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {mainView === 'settings' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="mx-auto max-w-5xl space-y-5">
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Profile</CardTitle>
                    <CardDescription>App-level profile fields and your public profile URL.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Display name</label>
                      <Input value={profileForm.displayName} onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Public username</label>
                      <Input value={profileForm.publicUsername} onChange={(event) => setProfileForm((current) => ({ ...current, publicUsername: event.target.value }))} placeholder="your_name" />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Profile image URL</label>
                      <Input value={profileForm.imageUrl} onChange={(event) => setProfileForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://..." />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <label className="text-sm font-medium">Bio</label>
                      <Textarea value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} className="min-h-24" />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {workspace?.user.publicUsername ? `Public URL: ${window.location.origin}/u/${workspace.user.publicUsername}` : 'Set a public username to publish a profile page.'}
                      </div>
                      <div className="flex gap-2">
                        {workspace?.user.publicUsername ? (
                          <Button variant="outline" onClick={() => navigateToProfile(workspace.user.publicUsername!)}>Open profile</Button>
                        ) : null}
                        <Button disabled={isSavingProfile} onClick={() => saveProfile().catch((error: Error) => setErrorMessage(error.message))}>
                          {isSavingProfile ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                          Save profile
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Defaults and memory</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Theme</label>
                      <div className="flex gap-2">
                        <Button variant={theme === 'light' ? 'secondary' : 'outline'} onClick={theme === 'light' ? undefined : onToggleTheme}>Light</Button>
                        <Button variant={theme === 'dark' ? 'secondary' : 'outline'} onClick={theme === 'dark' ? undefined : onToggleTheme}>Dark</Button>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Roast level</label>
                      <select className="h-9 border border-input bg-transparent px-3 text-sm" value={preferenceForm.roastLevel} onChange={(event) => setPreferenceForm((current) => ({ ...current, roastLevel: event.target.value as PreferenceRecord['roastLevel'] }))}>
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Response length</label>
                      <select className="h-9 border border-input bg-transparent px-3 text-sm" value={preferenceForm.responseLength} onChange={(event) => setPreferenceForm((current) => ({ ...current, responseLength: event.target.value as PreferenceRecord['responseLength'] }))}>
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Format</label>
                      <select className="h-9 border border-input bg-transparent px-3 text-sm" value={preferenceForm.outputFormat} onChange={(event) => setPreferenceForm((current) => ({ ...current, outputFormat: event.target.value as PreferenceRecord['outputFormat'] }))}>
                        <option value="bullets">Bullets</option>
                        <option value="paragraphs">Paragraphs</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Answer mode</label>
                      <select className="h-9 border border-input bg-transparent px-3 text-sm" value={preferenceForm.answerMode} onChange={(event) => setPreferenceForm((current) => ({ ...current, answerMode: event.target.value as PreferenceRecord['answerMode'] }))}>
                        <option value="fast">Fast</option>
                        <option value="balanced">Balanced</option>
                        <option value="deep">Deep research</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Model</label>
                      <select className="h-9 border border-input bg-transparent px-3 text-sm" value={preferenceForm.preferredModel} onChange={(event) => setPreferenceForm((current) => ({ ...current, preferredModel: event.target.value }))}>
                        {MODEL_OPTIONS.map((model) => <option key={model} value={model}>{model}</option>)}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Default folder</label>
                      <select className="h-9 border border-input bg-transparent px-3 text-sm" value={preferenceForm.defaultFolderId ?? 'none'} onChange={(event) => setPreferenceForm((current) => ({ ...current, defaultFolderId: event.target.value === 'none' ? null : event.target.value }))}>
                        <option value="none">None</option>
                        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-3 border border-border px-3 py-3 text-sm md:col-span-2">
                      <input type="checkbox" checked={preferenceForm.onlyFromSources} onChange={(event) => setPreferenceForm((current) => ({ ...current, onlyFromSources: event.target.checked }))} />
                      Only answer from sources by default
                    </label>
                    <div className="grid gap-2 md:col-span-2">
                      <label className="text-sm font-medium">Reusable memory</label>
                      <Textarea value={preferenceForm.memoryNotes} onChange={(event) => setPreferenceForm((current) => ({ ...current, memoryNotes: event.target.value }))} className="min-h-24" />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <Button disabled={isSavingPreferences} onClick={() => savePreferences().catch((error: Error) => setErrorMessage(error.message))}>
                        {isSavingPreferences ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        Save defaults
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Usage and data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-background/65 px-4 py-3"><div className="text-xs text-muted-foreground">Sent today</div><div className="mt-1 text-2xl font-semibold">{workspace?.usage.sentToday ?? 0}</div></div>
                      <div className="rounded-2xl bg-background/65 px-4 py-3"><div className="text-xs text-muted-foreground">Remaining</div><div className="mt-1 text-2xl font-semibold">{workspace?.usage.remainingToday ?? 'Unlimited'}</div></div>
                      <div className="rounded-2xl bg-background/65 px-4 py-3"><div className="text-xs text-muted-foreground">Recoverable deleted chats</div><div className="mt-1 text-2xl font-semibold">{workspace?.usage.deletedRecoverableCount ?? 0}</div></div>
                    </div>
                    <div className="rounded-2xl bg-background/55">
                      {(workspace?.usage.activity ?? []).slice(0, 10).map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{item.type}</div>
                            <div className="truncate text-xs text-muted-foreground">{JSON.stringify(item.metadata ?? {})}</div>
                          </div>
                          <div className="shrink-0 text-xs text-muted-foreground">{timeLabel(item.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" disabled={isExportingData} onClick={() => exportStoredData().catch((error: Error) => setErrorMessage(error.message))}>
                        {isExportingData ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                        Export data
                      </Button>
                      <Button variant="destructive" disabled={isDeletingData} onClick={() => deleteStoredData().catch((error: Error) => setErrorMessage(error.message))}>
                        {isDeletingData ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                        Delete stored data
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Premium</CardTitle>
                    <CardDescription>Free includes {dailyLimitLabel(workspace?.user.billing.dailyMessageLimit ?? 2)}. Premium raises the daily limit and is enforced entirely from verified server billing state.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-background/65 px-4 py-3">
                        <div className="text-xs text-muted-foreground">Plan</div>
                        <div className="mt-1 text-lg font-semibold">{workspace?.user.billing.planName ?? 'Free'}</div>
                      </div>
                      <div className="rounded-2xl bg-background/65 px-4 py-3">
                        <div className="text-xs text-muted-foreground">Status</div>
                        <div className="mt-1 text-lg font-semibold capitalize">{workspace?.user.billing.status ?? 'inactive'}</div>
                      </div>
                      <div className="rounded-2xl bg-background/65 px-4 py-3">
                        <div className="text-xs text-muted-foreground">Daily limit</div>
                        <div className="mt-1 text-lg font-semibold">{dailyLimitLabel(workspace?.user.billing.dailyMessageLimit ?? 2)}</div>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between pb-2">
                        <span>Price</span>
                        <span>{moneyLabel(workspace?.user.billing.amountPaise ?? 10000, workspace?.user.billing.currency ?? 'INR') ?? 'Rs 100 / month'}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2">
                        <span>Renews / access ends</span>
                        <span>{workspace?.user.billing.renewsAt ? timeLabel(workspace.user.billing.renewsAt) : 'Not subscribed'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Subscription ID</span>
                        <span className="max-w-[220px] truncate">{workspace?.user.billing.razorpaySubscriptionId ?? 'None'}</span>
                      </div>
                    </div>

                    {workspace?.user.billing.failureReason ? (
                      <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>Billing attention needed</AlertTitle>
                        <AlertDescription>{workspace.user.billing.failureReason}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex flex-wrap justify-end gap-2">
                      {workspace?.user.billing.isPremium ? (
                        <Button
                          variant="outline"
                          disabled={isCancellingSubscription}
                          onClick={() => cancelPremiumSubscription().catch((error: Error) => setErrorMessage(error.message))}
                        >
                          {isCancellingSubscription ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                          Cancel at cycle end
                        </Button>
                      ) : (
                        <Button
                          disabled={isStartingSubscription}
                          onClick={() => startPremiumCheckout().catch((error: Error) => setErrorMessage(error.message))}
                        >
                          {isStartingSubscription ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                          Upgrade to Premium
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : selectedChat ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-5">
                  {showChatSettingsPanel ? (
                    <Card className="shadow-none">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">Chat controls</CardTitle>
                            <CardDescription>Per-chat behavior, context budget, and answer style.</CardDescription>
                          </div>
                          <Button variant="ghost" size="icon-sm" title="Hide chat controls" onClick={() => setShowChatSettingsPanel(false)}>
                            <X className="size-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Folder</label>
                          <select className="h-9 border border-input bg-transparent px-3 text-sm" value={currentFolderId ?? 'none'} onChange={(event) => moveChatToFolder(event.target.value === 'none' ? null : event.target.value).catch((error: Error) => setErrorMessage(error.message))}>
                            <option value="none">Unfiled</option>
                            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Mode</label>
                          <select className="h-9 border border-input bg-transparent px-3 text-sm" value={chatSettingsForm.answerMode} onChange={(event) => setChatSettingsForm((current) => ({ ...current, answerMode: event.target.value as ChatSettings['answerMode'] }))}>
                            <option value="fast">Fast</option>
                            <option value="balanced">Balanced</option>
                            <option value="deep">Deep research</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Model</label>
                          <select className="h-9 border border-input bg-transparent px-3 text-sm" value={chatSettingsForm.preferredModel} onChange={(event) => setChatSettingsForm((current) => ({ ...current, preferredModel: event.target.value }))}>
                            {MODEL_OPTIONS.map((model) => <option key={model} value={model}>{model}</option>)}
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Roast level</label>
                          <select className="h-9 border border-input bg-transparent px-3 text-sm" value={chatSettingsForm.roastLevel} onChange={(event) => setChatSettingsForm((current) => ({ ...current, roastLevel: event.target.value as ChatSettings['roastLevel'] }))}>
                            <option value="light">Light</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Response length</label>
                          <select className="h-9 border border-input bg-transparent px-3 text-sm" value={chatSettingsForm.responseLength} onChange={(event) => setChatSettingsForm((current) => ({ ...current, responseLength: event.target.value as ChatSettings['responseLength'] }))}>
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="long">Long</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Output format</label>
                          <select className="h-9 border border-input bg-transparent px-3 text-sm" value={chatSettingsForm.outputFormat} onChange={(event) => setChatSettingsForm((current) => ({ ...current, outputFormat: event.target.value as ChatSettings['outputFormat'] }))}>
                            <option value="bullets">Bullets</option>
                            <option value="paragraphs">Paragraphs</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Context budget</label>
                          <Input type="number" min={4} max={20} value={chatSettingsForm.contextWindow} onChange={(event) => setChatSettingsForm((current) => ({ ...current, contextWindow: Number(event.target.value || 12) }))} />
                        </div>
                        <label className="flex items-center gap-3 border border-border px-3 py-3 text-sm">
                          <input type="checkbox" checked={chatSettingsForm.useWebSearch} onChange={(event) => setChatSettingsForm((current) => ({ ...current, useWebSearch: event.target.checked }))} />
                          Default web search on
                        </label>
                        <label className="flex items-center gap-3 border border-border px-3 py-3 text-sm">
                          <input type="checkbox" checked={chatSettingsForm.onlyFromSources} onChange={(event) => setChatSettingsForm((current) => ({ ...current, onlyFromSources: event.target.checked }))} />
                          Only answer from sources
                        </label>
                        <div className="grid gap-2 md:col-span-2">
                          <label className="text-sm font-medium">Per-chat instructions</label>
                          <Textarea value={chatSettingsForm.systemPrompt} onChange={(event) => setChatSettingsForm((current) => ({ ...current, systemPrompt: event.target.value }))} className="min-h-24" />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                          <Button disabled={isSavingChatSettings} onClick={() => saveChatSettings().catch((error: Error) => setErrorMessage(error.message))}>
                            {isSavingChatSettings ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            Save chat settings
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {selectedChat.summary ? (
                    <Card className="shadow-none">
                      <CardHeader><CardTitle className="text-base">Conversation summary</CardTitle></CardHeader>
                      <CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedChat.summary}</p></CardContent>
                    </Card>
                  ) : null}

                  <motion.div variants={subtleList} initial={false} animate="animate" className="flex flex-col gap-5">
                    {selectedChat.messages.map((message, index) => (
                      <motion.section
                        key={message.id}
                        variants={fadeUp}
                        layout
                        className={joinClasses('premium-surface max-w-4xl overflow-hidden rounded-3xl px-4 py-4', message.role === 'user' ? 'ml-auto bg-muted/80' : 'bg-background/70')}
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant={message.role === 'user' ? 'secondary' : 'outline'}>{message.role === 'user' ? 'You' : 'Assistant'}</Badge>
                          <span className="text-xs text-muted-foreground">{timeLabel(message.createdAt)}</span>
                          {message.editedAt ? <Badge variant="outline">Edited</Badge> : null}
                          {message.webSearchUsed ? <Badge variant="outline">Web</Badge> : null}
                          {confidenceLabel(message.confidence) ? <Badge variant="outline">{confidenceLabel(message.confidence)}</Badge> : null}
                        </div>
                        {message.role === 'assistant' ? (
                          <div
                            className={joinClasses(
                              'prose-answer',
                              isSending && selectedChat.messages.at(-1)?.id === message.id && !message.content && 'streaming-caret',
                              isSending && selectedChat.messages.at(-1)?.id === message.id && message.content && 'streaming-caret',
                            )}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || (isSending && selectedChat.messages.at(-1)?.id === message.id ? 'Thinking...' : '')}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                        )}
                        {message.contextUsed?.length ? (
                          <div className="mt-4 rounded-2xl bg-muted/45 px-3 py-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Sparkles className="size-3.5" />
                              Injected context
                            </div>
                            <ul className="space-y-1 text-xs text-muted-foreground">
                              {message.contextUsed.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                        ) : null}
                        {message.sources?.length ? <MessageSources sources={message.sources} /> : null}
                        <div className="mt-4 flex max-w-full flex-wrap gap-2 overflow-hidden">
                          {message.role === 'user' ? (
                            <>
                              <Button variant="outline" size="sm" title="Edit and resend this message" onClick={() => { setEditingMessageId(message.id); setComposer(message.content) }}>
                                <Pencil className="mr-2 size-3.5" />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" title="Branch a new chat from here" onClick={() => branchFromMessage(message.id).catch((error: Error) => setErrorMessage(error.message))}>
                                <GitBranch className="mr-2 size-3.5" />
                                Branch
                              </Button>
                            </>
                          ) : null}
                          {message.role === 'assistant' && index === selectedChat.messages.length - 1 ? (
                            <Button variant="outline" size="sm" title="Regenerate the last answer" onClick={() => regenerateLastAnswer().catch((error: Error) => setErrorMessage(error.message))}>
                              <RotateCcw className="mr-2 size-3.5" />
                              Regenerate
                            </Button>
                          ) : null}
                          {message.followUps?.length ? (
                            <div className="grid w-full gap-2">
                              {message.followUps.map((item) => (
                                <Button
                                  key={item}
                                  variant="outline"
                                  size="sm"
                                  className="h-auto max-w-full justify-start px-3 py-2 text-left whitespace-normal break-words"
                                  onClick={() => sendMessage(item).catch((error: Error) => setErrorMessage(error.message))}
                                >
                                  {item}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </motion.section>
                    ))}
                    <div ref={messagesEndRef} />
                  </motion.div>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="mx-auto max-w-5xl">
                  <AnimatePresence>
                    {showUpgradePrompt ? (
                      <motion.div {...fadeScale} className="mb-3 rounded-2xl bg-background/75 px-4 py-3 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-medium">You’ve used today’s free messages.</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Upgrade to Premium for {moneyLabel(workspace?.user.billing.amountPaise ?? 10000, workspace?.user.billing.currency ?? 'INR') ?? 'Rs 100/month'} and get a higher daily limit.
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowUpgradePrompt(false)}
                            >
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              disabled={isStartingSubscription}
                              onClick={() => startPremiumCheckout().catch((error: Error) => setErrorMessage(error.message))}
                            >
                              {isStartingSubscription ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                              Get Premium
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <Textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        if (editingMessageId) editAndResendMessage().catch((error: Error) => setErrorMessage(error.message))
                        else sendMessage().catch((error: Error) => setErrorMessage(error.message))
                      }
                    }}
                    placeholder={editingMessageId ? 'Update that earlier message and resend.' : 'Ask a follow-up. Shift+Enter for a new line.'}
                    className="min-h-28"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={composerUseWebSearch} onChange={(event) => setComposerUseWebSearch(event.target.checked)} />
                        <Globe className="size-3.5" />
                        Web search for this message
                      </label>
                      <span>
                        {workspace?.usage.remainingToday === null
                          ? 'Unlimited messages available today'
                          : `${workspace?.usage.remainingToday ?? 0} messages left today`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingMessageId ? <Button variant="ghost" onClick={() => { setEditingMessageId(null); setComposer('') }}>Cancel</Button> : null}
                      <Button
                        disabled={isSending || !composer.trim()}
                        onClick={() => (
                          workspace?.usage.remainingToday === 0 && !workspace?.user.billing.isPremium
                            ? startPremiumCheckout().catch((error: Error) => setErrorMessage(error.message))
                            : (editingMessageId ? editAndResendMessage() : sendMessage()).catch((error: Error) => setErrorMessage(error.message))
                        )}
                      >
                        {isSending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                        {workspace?.usage.remainingToday === 0 && !workspace?.user.billing.isPremium
                          ? 'Upgrade to send more'
                          : editingMessageId ? 'Update and resend' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : activeFilter === 'trash' && trash.length ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="w-full max-w-xl space-y-3">
                {trash.map((chat) => (
                  <div key={chat.id} className="flex items-center justify-between rounded-2xl bg-background/70 px-4 py-3 shadow-sm">
                    <div>
                      <div className="text-sm font-medium">{chat.title}</div>
                      <div className="text-xs text-muted-foreground">Restore window active</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => restoreDeletedChat(chat.id).catch((error: Error) => setErrorMessage(error.message))}>
                      <RotateCcw className="mr-2 size-3.5" />
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted"><MessageSquare className="size-5" /></div>
                <h3 className="text-xl font-semibold tracking-tight">Start something useful</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a chat, keep context, and stop losing threads to product entropy.</p>
                <div className="mt-6">
                  <Button onClick={() => createNewChat().catch((error: Error) => setErrorMessage(error.message))}>
                    <Plus className="mr-2 size-4" />
                    New chat
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { isLoaded, userId } = useAuth()
  const [theme, setTheme] = useState<ThemeMode>('light')
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname))

  useEffect(() => {
    const saved = (window.localStorage.getItem('poorplexity-theme') as ThemeMode | null) ?? 'light'
    setTheme(saved)
    document.documentElement.classList.toggle('dark', saved === 'dark')
    const onPopState = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    window.localStorage.setItem('poorplexity-theme', next)
  }

  const navigateToProfile = (username: string) => {
    window.history.pushState({}, '', `/u/${username}`)
    setRoute({ kind: 'profile', username })
  }

  const navigateHome = () => {
    window.history.pushState({}, '', '/')
    setRoute({ kind: 'workspace' })
  }

  if (route.kind === 'profile') {
    return <PublicProfilePage username={route.username} theme={theme} onBack={navigateHome} onToggleTheme={toggleTheme} />
  }

  if (!isLoaded) return <WorkspaceSkeleton />

  return (
    <>
      <ClerkLoading>
        <WorkspaceSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        {userId ? (
          <Workspace theme={theme} onToggleTheme={toggleTheme} navigateToProfile={navigateToProfile} />
        ) : (
          <PublicWorkspace theme={theme} onToggleTheme={toggleTheme} />
        )}
      </ClerkLoaded>
    </>
  )
}
