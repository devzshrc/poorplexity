import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef, DragEvent, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ClerkLoaded, ClerkLoading, useAuth, useClerk } from '@clerk/react'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BarChart3,
  BookOpenText,
  Brain,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  Globe,
  LayoutTemplate,
  Loader2,
  ListTree,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Network,
  PanelLeft,
  PanelRightOpen,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkle,
  Sparkles,
  Sliders,
  Square,
  Star,
  Sun,
  Trash2,
  User,
  Database,
  CreditCard,
  X,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE_URL } from '@/lib/config'

type ThemeMode = 'light' | 'dark'
type ThemeToggleOrigin = { x: number; y: number }
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

type MainView = 'chat' | 'settings'
type SettingsSection = 'profile' | 'defaults' | 'memory' | 'chat' | 'data' | 'premium'
type AnswerStylePreset = 'concise' | 'structured' | 'deep-dive'
type SourceLayout = 'answer-first' | 'sources-first'
type SlashCommandId = 'summarize' | 'compare' | 'plan' | 'research' | 'rewrite'

type UsageDashboardPayload = {
  sentToday: number
  remainingToday: number | null
  dailyLimit: number | null
  totalChats: number
  archivedChats: number
  pinnedChats: number
  branchChats: number
  totalMessages: number
  userMessages: number
  assistantMessages: number
  webSearchReplies: number
  sourcedReplies: number
  folderCount: number
  averageMessagesPerChat: number
  topChats: Array<{
    id: string
    title: string
    messageCount: number
    updatedAt: string
    branchFromChatId: string | null
  }>
  topFolders: Array<{
    id: string
    name: string
    chatCount: number
  }>
  topSourceDomains: Array<{
    domain: string
    count: number
  }>
  topTopics: Array<{
    label: string
    count: number
  }>
  recentDays: Array<{
    key: string
    count: number
    prompts: number
    replies: number
    searches: number
  }>
  activity: UsageActivity[]
}

const MODEL_OPTIONS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
] as const

const fadeUp = { className: 'anim-fade-up' }
const subtleList = { className: '' }
const fadeScale = { className: 'anim-scale-in' }

type StaticMotionProps = {
  initial?: unknown
  animate?: unknown
  exit?: unknown
  transition?: unknown
  variants?: unknown
  whileHover?: unknown
  whileTap?: unknown
  layout?: unknown
}

function pickAnim(variants: unknown, fallback: string): string {
  if (variants && typeof variants === 'object' && 'className' in variants) {
    const value = (variants as { className?: unknown }).className
    if (typeof value === 'string') return value
  }
  return fallback
}

function StaticMotionDiv({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & StaticMotionProps) {
  const anim = pickAnim(variants, 'anim-fade-in')
  return <div className={joinClasses(anim, className)} {...props} />
}

function StaticMotionSection({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  className,
  ...props
}: ComponentPropsWithoutRef<'section'> & StaticMotionProps) {
  const anim = pickAnim(variants, 'anim-fade-up')
  return <section className={joinClasses(anim, className)} {...props} />
}

function StaticMotionButton({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants: _variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  ...props
}: ComponentPropsWithoutRef<'button'> & StaticMotionProps) {
  return <button {...props} />
}

function StaticMotionAnchor({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants: _variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  ...props
}: ComponentPropsWithoutRef<'a'> & StaticMotionProps) {
  return <a {...props} />
}

const AnimatePresence = ({ children }: { children: ReactNode }) => <>{children}</>
const motion = {
  a: StaticMotionAnchor,
  button: StaticMotionButton,
  div: StaticMotionDiv,
  section: StaticMotionSection,
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

function inferAnswerStyle(settings: Pick<PreferenceRecord, 'answerMode' | 'responseLength' | 'outputFormat'> | Pick<ChatSettings, 'answerMode' | 'responseLength' | 'outputFormat'>): AnswerStylePreset {
  if (settings.answerMode === 'deep' || settings.responseLength === 'long') return 'deep-dive'
  if (settings.answerMode === 'balanced' || settings.responseLength === 'medium') return 'structured'
  return 'concise'
}

function applyAnswerStylePreset<T extends Pick<PreferenceRecord, 'answerMode' | 'responseLength' | 'outputFormat'> | Pick<ChatSettings, 'answerMode' | 'responseLength' | 'outputFormat'>>(
  current: T,
  preset: AnswerStylePreset,
): T {
  if (preset === 'deep-dive') {
    return { ...current, answerMode: 'deep', responseLength: 'long', outputFormat: 'paragraphs' } as T
  }
  if (preset === 'structured') {
    return { ...current, answerMode: 'balanced', responseLength: 'medium', outputFormat: 'bullets' } as T
  }
  return { ...current, answerMode: 'fast', responseLength: 'short', outputFormat: 'bullets' } as T
}

function memoryItemsFromNotes(notes: string) {
  return notes
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
}

function notesFromMemoryItems(items: string[]) {
  return items.map((item) => `- ${item.trim()}`).join('\n')
}

function normalizeTopicLabel(label: string) {
  return label
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractSlashCommand(text: string): { command: SlashCommandId | null; content: string } {
  const match = text.trimStart().match(/^\/(summarize|compare|plan|research|rewrite)\b/i)
  if (!match) return { command: null, content: text }
  const command = match[1].toLowerCase() as SlashCommandId
  return {
    command,
    content: text.trimStart().slice(match[0].length).trim(),
  }
}

function commandPrompt(command: SlashCommandId, content: string) {
  if (command === 'summarize') return `Summarize this clearly with short sections, key points, and a bottom-line takeaway.\n\n${content}`
  if (command === 'compare') return `Compare this clearly. Use a short answer first, then bullets for differences, tradeoffs, and best choice.\n\n${content}`
  if (command === 'plan') return `Create a practical step-by-step plan. Keep it concrete, ordered, and easy to execute.\n\n${content}`
  if (command === 'research') return `Research this thoroughly. Use strong structure with sections, evidence, and recommendations.\n\n${content}`
  return `Rewrite this for clarity and polish. Keep the meaning, remove fluff, and improve structure.\n\n${content}`
}

const ANSWER_STYLE_OPTIONS: Array<{ id: AnswerStylePreset; label: string; description: string; icon: typeof Sparkle }> = [
  { id: 'concise', label: 'Concise', description: 'Tight answer, short bullets, minimal detail.', icon: Sparkle },
  { id: 'structured', label: 'Structured', description: 'Direct answer, sections, bullets, and annotations.', icon: LayoutTemplate },
  { id: 'deep-dive', label: 'Deep dive', description: 'Longer synthesis with more context and reasoning.', icon: Brain },
]

const COMPOSER_COMMANDS: Array<{ id: SlashCommandId; label: string; hint: string; icon: typeof Sparkle }> = [
  { id: 'summarize', label: '/summarize', hint: 'Turn anything into a crisp summary.', icon: BookOpenText },
  { id: 'compare', label: '/compare', hint: 'Break options into tradeoffs.', icon: ListTree },
  { id: 'plan', label: '/plan', hint: 'Generate a concrete action plan.', icon: ChevronRight },
  { id: 'research', label: '/research', hint: 'Push for a deeper sourced answer.', icon: Network },
  { id: 'rewrite', label: '/rewrite', hint: 'Polish text without changing meaning.', icon: Pencil },
]

function safeHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function formatActivityTypeLabel(type: string) {
  return type
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function summarizeActivity(item: UsageActivity) {
  const metadata = item.metadata ?? {}

  if (item.type === 'message.user.created') {
    const contentLength = typeof metadata.contentLength === 'number' ? metadata.contentLength : null
    return contentLength ? `User prompt saved${contentLength ? ` • ${contentLength} chars` : ''}` : 'User prompt saved'
  }

  if (item.type === 'message.assistant.created') {
    const contentLength = typeof metadata.contentLength === 'number' ? metadata.contentLength : null
    return contentLength ? `Assistant reply stored • ${contentLength} chars` : 'Assistant reply stored'
  }

  if (item.type === 'chat.created') {
    return typeof metadata.title === 'string' && metadata.title
      ? `New chat created • ${metadata.title}`
      : 'New chat created'
  }

  if (item.type === 'chat.archived') return 'Chat moved out of the main list'
  if (item.type === 'chat.restored') return 'Chat restored from trash'
  if (item.type === 'chat.deleted') return 'Chat moved to trash'
  if (item.type === 'folder.created') {
    return typeof metadata.name === 'string' && metadata.name
      ? `Folder created • ${metadata.name}`
      : 'Folder created'
  }
  if (item.type === 'billing.subscription.verified') return 'Premium billing verified'

  const importantPairs = Object.entries(metadata)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`)

  return importantPairs.length ? importantPairs.join(' • ') : 'Workspace activity recorded'
}

function activityAccentClass(type: string) {
  if (type.startsWith('message.user')) return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/12 dark:text-blue-200'
  if (type.startsWith('message.assistant')) return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/12 dark:text-violet-200'
  if (type.startsWith('chat.')) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/12 dark:text-emerald-200'
  if (type.startsWith('folder.')) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/12 dark:text-amber-200'
  if (type.startsWith('billing.')) return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/12 dark:text-cyan-200'
  return 'bg-muted text-foreground border-border'
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

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: ThemeMode
  onToggle: (origin: ThemeToggleOrigin) => void
}) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="h-9 w-9"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onToggle({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      }}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function faviconUrl(url: string) {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?sz=32&domain=${host}`
  } catch {
    return ''
  }
}

function CitationsSkeleton() {
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

function MessageSources({
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

function CitationInline({
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

function preprocessCitations(text: string, sourceCount: number) {
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

function WorkspaceSkeleton() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background p-3 sm:p-6 lg:h-dvh lg:overflow-hidden">
      <div className="grid gap-3 sm:gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-md border border-border bg-card p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-3 h-9 w-full" />
          <Skeleton className="mt-6 h-20 w-full" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-24 w-full" />
          <Skeleton className="mt-4 h-24 w-4/5" />
          <Skeleton className="mt-8 h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

type AuthOverlayProps = {
  isOpen: boolean
  onClose: () => void
}

function AuthOverlay({
  isOpen,
  onClose,
}: AuthOverlayProps) {
  const clerk = useClerk()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const redirectUrl = typeof window === 'undefined' ? '/' : window.location.href

  useEffect(() => {
    if (!isOpen) {
      setAuthError('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  const continueWithGoogle = async () => {
    setIsSubmitting(true)
    setAuthError('')
    try {
      await (clerk.client.signIn as unknown as {
        authenticateWithRedirect: (params: {
          strategy: 'oauth_google'
          redirectUrl: string
          redirectUrlComplete: string
        }) => Promise<unknown>
      }).authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl,
        redirectUrlComplete: redirectUrl,
      })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          {...fadeUp}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-4"
        >
          <motion.div {...fadeUp} className="w-full max-w-sm">
            <Card className="premium-surface w-full shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Continue with Google</CardTitle>
                    <CardDescription className="mt-1">
                      Sign in to send, save, branch, export, and keep your workspace without leaving our UI first.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon-sm" title="Close sign-in" onClick={onClose}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                  We only support Google sign-in right now, so the flow stays short and clean.
                </div>

                <Button className="h-11 w-full justify-center" disabled={isSubmitting} onClick={() => void continueWithGoogle()}>
                  {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
                  Continue with Google
                </Button>

                {authError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{authError}</AlertDescription>
                  </Alert>
                ) : null}

                <p className="text-center text-xs text-muted-foreground">
                  This sheet is ours. Clerk only handles the secure Google session once you continue.
                </p>

                <Button variant="ghost" className="w-full justify-center" onClick={onClose}>
                  Continue without signing in
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
  onToggleTheme: (origin?: ThemeToggleOrigin) => void
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
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3">
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
                    <img src={profile.profile.imageUrl} alt="" className="size-16 rounded-md object-cover" />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-md bg-muted text-lg font-semibold">
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
  onToggleTheme: (origin?: ThemeToggleOrigin) => void
}) {
  const [composer, setComposer] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [examples] = useState([
    'Compare the latest M4 MacBook Air with comparable Windows ultrabooks.',
    'Explain bun vs node for production APIs with tradeoffs.',
    'Summarize the strongest arguments for and against nuclear power.',
  ])

  const openAuth = () => {
    window.localStorage.setItem('poorplexity-pending-draft', composer.trim())
    setShowAuth(true)
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background p-4 sm:p-6 lg:h-dvh lg:overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <div>
          <div className="text-base font-semibold tracking-tight">poorplexity</div>
          <div className="text-[11px] text-muted-foreground">Public workspace preview</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Button variant="outline" size="icon-sm" title="Open navigation" onClick={() => setShowSidebar(true)}>
            <PanelLeft className="size-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showSidebar ? (
          <motion.button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 z-30 bg-background/60 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="grid gap-3 lg:gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          className={joinClasses(
            'fixed inset-y-4 left-4 z-40 flex w-[min(88vw,340px)] min-h-0 flex-col rounded-md border border-border bg-card transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0',
            showSidebar ? 'translate-x-0' : '-translate-x-[120%]',
          )}
        >
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
            <div className="rounded-md border border-border bg-background/60 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Try these</div>
              <div className="space-y-2">
                {examples.map((item) => (
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.995 }}
                    key={item}
                    onClick={() => {
                      setComposer(item)
                      setShowSidebar(false)
                    }}
                    className="premium-surface w-full border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    {item}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col rounded-md border border-border bg-card">
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Ask first. Sign in when it matters.</h2>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                  You can explore the workspace before login. Sending a message opens the minimal auth prompt.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button className="h-10 sm:min-w-28" variant="outline" onClick={openAuth}>
                  Sign in
                </Button>
                <Button className="h-10 sm:min-w-36" onClick={openAuth}>
                  Continue with Google
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-visible px-4 py-3 sm:px-5 sm:py-5 lg:min-h-0 lg:overflow-y-auto">
            <motion.div variants={subtleList} initial={false} animate="animate" className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-5">
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

              <motion.section {...fadeUp} className="premium-surface rounded-md border border-border bg-background/70 px-4 py-4 sm:px-5">
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

          <div className="glass mobile-composer sticky bottom-0 z-20 mt-auto border-t border-border px-4 py-3 sm:px-5 sm:py-4">
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
                className="min-h-18 max-h-32 sm:min-h-28"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground sm:text-xs">Your draft will be preserved through sign-in.</p>
                <Button className="h-11 w-full sm:w-auto" disabled={!composer.trim()} onClick={() => openAuth()}>
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
  onToggleTheme: (origin?: ThemeToggleOrigin) => void
  navigateToProfile: (username: string) => void
}) {
  const { getToken } = useAuth()
  const clerk = useClerk()
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null)
  const [chatCache, setChatCache] = useState<Record<string, ChatDetail>>({})
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
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
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile')
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
  const [isDeletingData, setIsDeletingData] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isStartingSubscription, setIsStartingSubscription] = useState(false)
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [sourceLayout, setSourceLayout] = useState<SourceLayout>('answer-first')
  const [activeSource, setActiveSource] = useState<{ messageId: string; index: number; source: Source } | null>(null)
  const [usageDashboard, setUsageDashboard] = useState<UsageDashboardPayload | null>(null)
  const [isLoadingUsageDashboard, setIsLoadingUsageDashboard] = useState(false)
  const [draftMemoryItem, setDraftMemoryItem] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const toolsMenuRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to copy')
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsSending(false)
  }


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
    setUsageDashboard(null)
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
    const storedSourceLayout = window.localStorage.getItem('poorplexity-source-layout')
    if (storedSourceLayout === 'answer-first' || storedSourceLayout === 'sources-first') {
      setSourceLayout(storedSourceLayout)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('poorplexity-source-layout', sourceLayout)
  }, [sourceLayout])

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
    const limitReached = workspace?.usage.remainingToday === 0 && !workspace?.user.billing.isPremium
    setShowUpgradePrompt(Boolean(limitReached))
  }, [workspace?.usage.remainingToday, workspace?.user.billing.isPremium])

  const folders = workspace?.folders ?? []
  const chats = workspace?.chats ?? []
  const usage = workspace?.usage ?? null
  const usageActivity = usage?.activity ?? []
  const selectedChat = selectedChatId ? chatCache[selectedChatId] ?? null : null
  const currentFolderId = selectedChat?.folderId ?? null
  const userInitial = (workspace?.user.displayName || 'P').trim().charAt(0).toUpperCase()
  const isSettingsOpen = mainView === 'settings'

  const usageOverview = useMemo(() => {
    const sentToday = usage?.sentToday ?? 0
    const remainingToday = usage?.remainingToday ?? null
    const dailyLimit = usage?.dailyLimit ?? null
    const deletedRecoverableCount = usage?.deletedRecoverableCount ?? 0
    const totalLoggedEvents = usageActivity.length
    const userPrompts = usageActivity.filter((item) => item.type === 'message.user.created').length
    const assistantReplies = usageActivity.filter((item) => item.type === 'message.assistant.created').length
    const chatsCreated = usageActivity.filter((item) => item.type === 'chat.created').length
    const quotaRatio = typeof dailyLimit === 'number' && dailyLimit > 0
      ? Math.min(1, sentToday / dailyLimit)
      : null

    const recentDays = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - offset))
      const key = date.toISOString().slice(0, 10)
      const label = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
      return { key, label, count: 0 }
    })

    const dayIndex = new Map(recentDays.map((day, index) => [day.key, index]))
    for (const item of usageActivity) {
      const key = new Date(item.createdAt).toISOString().slice(0, 10)
      const index = dayIndex.get(key)
      if (typeof index === 'number') recentDays[index].count += 1
    }

    const peakDayCount = Math.max(1, ...recentDays.map((day) => day.count))

    return {
      sentToday,
      remainingToday,
      dailyLimit,
      deletedRecoverableCount,
      totalLoggedEvents,
      userPrompts,
      assistantReplies,
      chatsCreated,
      quotaRatio,
      recentDays,
      peakDayCount,
    }
  }, [usage, usageActivity])

  const memoryItems = useMemo(() => memoryItemsFromNotes(preferenceForm.memoryNotes), [preferenceForm.memoryNotes])

  const branchInsights = useMemo(() => {
    if (!selectedChat) return null
    const parent = selectedChat.branchFromChatId
      ? chats.find((chat) => chat.id === selectedChat.branchFromChatId) ?? null
      : null
    const children = chats.filter((chat) => chat.branchFromChatId === selectedChat.id)
    return {
      parent,
      children,
      siblingCount: parent ? chats.filter((chat) => chat.branchFromChatId === parent.id).length : 0,
    }
  }, [selectedChat, chats])

  const currentAnswerStyle = inferAnswerStyle(chatSettingsForm)
  const defaultAnswerStyle = inferAnswerStyle(preferenceForm)

  const openSourceViewer = (messageId: string, source: Source, index: number) => {
    setActiveSource({ messageId, source, index })
  }

  const addMemoryItem = () => {
    const next = draftMemoryItem.trim()
    if (!next) return
    setPreferenceForm((current) => ({
      ...current,
      memoryNotes: notesFromMemoryItems([...memoryItemsFromNotes(current.memoryNotes), next]),
    }))
    setDraftMemoryItem('')
  }

  const removeMemoryItem = (item: string) => {
    setPreferenceForm((current) => ({
      ...current,
      memoryNotes: notesFromMemoryItems(memoryItemsFromNotes(current.memoryNotes).filter((entry) => entry !== item)),
    }))
  }

  const applyCommandChip = (command: SlashCommandId) => {
    setComposer((current) => {
      const trimmed = current.trim()
      return trimmed ? `/${command} ${trimmed}` : `/${command} `
    })
    if (command === 'research') setComposerUseWebSearch(true)
    composerRef.current?.focus()
  }

  useEffect(() => {
    if (selectedChat?.settings) {
      setChatSettingsForm(clone(selectedChat.settings))
      setComposerUseWebSearch(selectedChat.settings.useWebSearch)
    }
  }, [selectedChat?.id, selectedChat?.settings])

  useEffect(() => {
    if (settingsSection !== 'data' || usageDashboard || isLoadingUsageDashboard) return
    setIsLoadingUsageDashboard(true)
    authorizedFetch('/api/settings/usage')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
        return await res.json() as UsageDashboardPayload
      })
      .then((payload) => setUsageDashboard(payload))
      .catch((error: Error) => setErrorMessage(error.message))
      .finally(() => setIsLoadingUsageDashboard(false))
  }, [settingsSection, usageDashboard, isLoadingUsageDashboard])

  useEffect(() => {
    setActiveSource((current) => {
      if (!current || !selectedChat) return current
      return selectedChat.messages.some((message) => message.id === current.messageId) ? current : null
    })
  }, [selectedChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [selectedChatId, selectedChat?.messages.length])

  useEffect(() => {
    if (!showToolsMenu) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!toolsMenuRef.current?.contains(event.target as Node)) {
        setShowToolsMenu(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowToolsMenu(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showToolsMenu])

  useEffect(() => {
    const isMobileOverlay = (showSidebar || mainView === 'settings')
      && typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
    if (isMobileOverlay) {
      document.body.classList.add('lock-scroll')
      return () => document.body.classList.remove('lock-scroll')
    }
    document.body.classList.remove('lock-scroll')
  }, [showSidebar, mainView])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isInField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        createNewChat().catch((error: Error) => setErrorMessage(error.message))
        return
      }
      if (meta && event.key === '/') {
        event.preventDefault()
        composerRef.current?.focus()
        return
      }
      if (event.key === 'Escape') {
        if (isSending) {
          event.preventDefault()
          stopStreaming()
        }
        return
      }
      if (event.key === 'ArrowUp' && !meta && !event.shiftKey && !event.altKey) {
        if (target === composerRef.current && composer.length === 0 && selectedChat) {
          const lastUser = [...selectedChat.messages].reverse().find((m) => m.role === 'user')
          if (lastUser) {
            event.preventDefault()
            setEditingMessageId(lastUser.id)
            setComposer(lastUser.content)
          }
        }
        return
      }

      if (isInField) return
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isSending, composer, selectedChat])

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
    const base = chats.filter((chat) => {
      if (chat.isArchived) return false
      if (!selectedFolderId) return true
      return chat.folderId === selectedFolderId
    })
    return [...base].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)
    })
  }, [chats, selectedFolderId])

  const groupedChatsCount = useMemo(() => {
    const next = new Map<string | null, number>()
    for (const chat of chats) next.set(chat.folderId, (next.get(chat.folderId) ?? 0) + 1)
    return next
  }, [chats])

  const createNewChat = async (branch?: { chatId: string; messageId?: string | null }) => {
    setIsCreatingChat(true)
    try {
      const selectedSummary = selectedChatId
        ? workspace?.chats.find((chat) => chat.id === selectedChatId) ?? workspace?.trash.find((chat) => chat.id === selectedChatId) ?? null
        : null

      if (
        !branch
        && selectedSummary
        && selectedSummary.messageCount === 0
        && selectedSummary.title === 'Untitled chat'
      ) {
        await authorizedFetch(`/api/chats/${selectedSummary.id}`, { method: 'DELETE' })
      }

      const res = await authorizedFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId ?? preferenceForm.defaultFolderId,
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
  }

  const softDeleteChatById = async (chatId: string) => {
    const res = await authorizedFetch(`/api/chats/${chatId}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }).error ?? `HTTP ${res.status}`)
    setChatCache((current) => {
      const next = { ...current }
      delete next[chatId]
      return next
    })
    await loadWorkspace(false)
    setSelectedChatId((current) => (current === chatId ? null : current))
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
    const rawInput = (seed ?? composer).trim()
    const parsedCommand = extractSlashCommand(rawInput)
    const content = parsedCommand.command
      ? commandPrompt(parsedCommand.command, parsedCommand.content || 'Use the current chat context.')
      : rawInput
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
      if (!activeChatId) activeChatId = await createNewChat()
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
        body: JSON.stringify({
          content,
          useWebSearch: parsedCommand.command === 'research' ? true : composerUseWebSearch,
        }),
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
        setComposer(seed ? previousComposer : rawInput)
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
    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const renderInline = (value: string) => escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

    const renderMarkdown = (text: string) => {
      const lines = text.split('\n')
      const out: string[] = []
      let inCode = false
      let inList = false
      const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
      for (const raw of lines) {
        if (raw.startsWith('```')) {
          closeList()
          if (inCode) { out.push('</code></pre>'); inCode = false }
          else { out.push('<pre><code>'); inCode = true }
          continue
        }
        if (inCode) { out.push(escapeHtml(raw)); continue }
        if (/^#{1,6}\s/.test(raw)) {
          closeList()
          const level = raw.match(/^#+/)![0].length
          out.push(`<h${level}>${renderInline(raw.replace(/^#+\s+/, ''))}</h${level}>`)
          continue
        }
        if (/^\s*[-*]\s+/.test(raw)) {
          if (!inList) { out.push('<ul>'); inList = true }
          out.push(`<li>${renderInline(raw.replace(/^\s*[-*]\s+/, ''))}</li>`)
          continue
        }
        if (/^>\s?/.test(raw)) {
          closeList()
          out.push(`<blockquote>${renderInline(raw.replace(/^>\s?/, ''))}</blockquote>`)
          continue
        }
        if (raw.trim() === '') { closeList(); out.push(''); continue }
        closeList()
        out.push(`<p>${renderInline(raw)}</p>`)
      }
      closeList()
      if (inCode) out.push('</code></pre>')
      return out.join('\n')
    }

    const safeTitle = escapeHtml(selectedChat.title || 'Chat')
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #111; line-height: 1.55; max-width: 760px; margin: 0 auto; padding: 8px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 6px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 18px 0 6px; }
  p { margin: 8px 0; font-size: 12.5px; }
  ul { margin: 6px 0 6px 22px; padding: 0; }
  li { font-size: 12.5px; margin: 3px 0; }
  blockquote { border-left: 3px solid #ccc; margin: 10px 0; padding: 4px 12px; color: #555; font-style: italic; }
  code { background: #f3f3f3; padding: 1px 4px; border-radius: 3px; font-size: 11.5px; }
  pre { background: #f6f6f6; padding: 10px 12px; border-radius: 4px; overflow: auto; font-size: 11.5px; }
  pre code { background: transparent; padding: 0; }
  a { color: #0a58ca; text-decoration: none; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
</style></head><body>
<div class="meta">Exported ${escapeHtml(new Date().toLocaleString())} · poorplexity</div>
${renderMarkdown(markdown)}
</body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }, 1000)
    }

    const triggerPrint = () => {
      const win = iframe.contentWindow
      if (!win) { cleanup(); return }
      try {
        win.focus()
        win.print()
      } catch {
        // ignore
      }
      win.addEventListener('afterprint', cleanup, { once: true })
      window.setTimeout(cleanup, 60000)
    }

    iframe.onload = () => window.setTimeout(triggerPrint, 50)
    const doc = iframe.contentDocument
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
      if (doc.readyState === 'complete') window.setTimeout(triggerPrint, 50)
    } else {
      cleanup()
    }
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
        style={{ paddingLeft: depth ? `${depth * 12}px` : undefined }}
      >
        <div className={joinClasses('premium-surface relative rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted', selectedFolderId === folder.id && 'bg-muted')}>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              onClick={() => {
                setSelectedFolderId(folder.id)
                setShowSidebar(false)
              }}
              title={folder.name}
            >
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{folder.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{groupedChatsCount.get(folder.id) ?? 0} chats</span>
                  {folder.parentFolderId ? <span>Nested</span> : null}
                </div>
              </div>
            </button>
            <div className="flex items-center gap-1.5">
              {folder.isFavorite ? <Star className="size-3.5 shrink-0 fill-current text-muted-foreground" /> : null}
              <div className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {groupedChatsCount.get(folder.id) ?? 0}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 shrink-0"
              title="Folder tools"
              onClick={() => setOpenFolderMenuId((current) => current === folder.id ? null : folder.id)}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
          <AnimatePresence>
          {openFolderMenuId === folder.id ? (
            <motion.div
              {...fadeUp}
              className="glass-soft relative mt-2 rounded-md border border-border p-1"
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
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
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
    <div className="min-h-dvh overflow-x-hidden bg-background p-0 safe-x lg:h-dvh lg:overflow-hidden">
      <div className="safe-top mb-3 flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          size="icon-sm"
          className="h-10 w-10 shrink-0"
          title="Open navigation"
          onClick={() => setShowSidebar(true)}
        >
          <PanelLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tracking-tight">poorplexity</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {selectedChat ? selectedChat.title : 'Research workspace'}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="h-10 w-10 shrink-0"
          title="New chat"
          disabled={isCreatingChat}
          onClick={() => createNewChat().catch((error: Error) => setErrorMessage(error.message))}
        >
          {isCreatingChat ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-5" />}
        </Button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <AnimatePresence>
        {showSidebar ? (
          <motion.button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-background/70 lg:hidden anim-fade-in"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="grid gap-0 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          className={joinClasses(
            'glass fixed inset-y-0 left-0 z-40 flex w-[min(86vw,340px)] min-h-0 flex-col overflow-hidden rounded-none border border-border transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] safe-top lg:static lg:inset-auto lg:w-auto lg:translate-x-0 lg:rounded-r-none lg:border-r-0',
            showSidebar ? 'translate-x-0' : '-translate-x-[110%] lg:translate-x-0',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-5 py-5">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">poorplexity</h1>
              <p className="truncate text-xs text-muted-foreground">Research workspace</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="hidden lg:block"><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div>
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{userInitial}</div>
              <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" title="Sign out" onClick={() => clerk.signOut({ redirectUrl: window.location.origin })}>
                <LogOut className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9 lg:hidden"
                title="Close navigation"
                onClick={() => setShowSidebar(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 px-5 pb-4">
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
                onClick={() => {
                  setMainView('settings')
                  setShowSidebar(false)
                }}
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

          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/75">Folders</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{folders.length} total</div>
              </div>
              <Button variant={showFolderCreator ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFolderCreator((current) => !current)}>
                <FolderPlus className="mr-2 size-4" />
                {showFolderCreator ? 'Close' : 'New folder'}
              </Button>
            </div>
            {showFolderCreator ? (
              <div className="grid gap-2 rounded-md border border-border bg-background/65 p-3">
                <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Folder name (optional)" />
                <Select value={folderParentId} onChange={(event) => setFolderParentId(event.target.value)}>
                  <option value="root">Top level</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </Select>
                <Button variant="outline" disabled={isCreatingFolder} onClick={() => createFolder().then(() => setShowFolderCreator(false)).catch((error: Error) => setErrorMessage(error.message))}>
                  {isCreatingFolder ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FolderPlus className="mr-2 size-4" />}
                  Create folder
                </Button>
              </div>
            ) : null}
            {selectedFolderId ? (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  setSelectedFolderId(null)
                  setShowSidebar(false)
                }}
              >
                <ArrowLeft className="mr-2 size-4" />
                Back to all chats
              </Button>
            ) : null}
          </div>

          <Separator />

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 safe-bottom">
            {searchQuery.trim() ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Chats</div>
                  <motion.div variants={subtleList} initial={false} animate="animate" className="space-y-2">
                  {(searchResults?.chats ?? []).map((chat) => (
                    <motion.button
                      variants={fadeUp}
                      key={chat.id}
                      onClick={() => { setSelectedChatId(chat.id); setMainView('chat'); setShowSidebar(false) }}
                      className={joinClasses('premium-surface w-full rounded-md border border-border bg-background/70 px-3 py-2 text-left transition-colors hover:bg-muted', selectedChatId === chat.id && 'bg-muted')}
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
                      onClick={() => { setSelectedChatId(message.chatId); setMainView('chat'); setShowSidebar(false) }}
                      className="premium-surface w-full rounded-md border border-border bg-background/70 px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <div className="text-xs font-medium">{message.chatTitle}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{message.content}</div>
                    </motion.button>
                  ))}
                  </motion.div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  {renderFolders(null)}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/75">
                      {selectedFolderId ? 'Chats in folder' : 'Chats'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{visibleChats.length}</div>
                  </div>
                <motion.div variants={subtleList} initial={false} animate="animate" className="space-y-2">
                  {visibleChats.map((chat) => (
                    <motion.div
                      variants={fadeUp}
                      key={chat.id}
                    >
                      <div className={joinClasses('premium-surface rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted', selectedChatId === chat.id && 'bg-muted')}>
                        <div className="flex items-start gap-2.5">
                          <button
                            draggable
                            onDragStart={(event: DragEvent<HTMLButtonElement>) => event.dataTransfer.setData('text/plain', chat.id)}
                            onClick={() => { setSelectedChatId(chat.id); setMainView('chat'); setShowSidebar(false) }}
                            className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                          >
                            <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-medium">{chat.title}</div>
                                {chat.isPinned ? <Pin className="size-3 text-muted-foreground" /> : null}
                                {chat.branchFromChatId ? <GitBranch className="size-3 text-muted-foreground" /> : null}
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{chat.lastMessagePreview || 'No messages yet.'}</div>
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="mt-0.5 shrink-0"
                            title="Delete chat"
                            onClick={(event) => {
                              event.stopPropagation()
                              softDeleteChatById(chat.id).catch((error: Error) => setErrorMessage(error.message))
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="relative flex min-h-0 flex-col overflow-hidden rounded-none border border-border bg-card lg:rounded-l-none">
          <div className="border-b border-border/60 px-5 py-5">
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
              {selectedChat ? (
                editingTitle ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="w-full sm:w-[280px]" />
                    <Button className="h-9 w-9 shrink-0" size="icon-sm" title="Save title" onClick={() => authorizedFetch(`/api/chats/${selectedChat.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: draftTitle }) }).then(() => loadWorkspace()).then(() => loadChat(selectedChat.id)).then(() => setEditingTitle(false)).catch((error: Error) => setErrorMessage(error.message))}><Check className="size-4" /></Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg lg:text-xl">{selectedChat.title}</h2>
                      {selectedChat.isPinned ? <Badge variant="outline">Pinned</Badge> : null}
                      {selectedChat.isArchived ? <Badge variant="outline">Archived</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
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
              <div className="relative flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                <Button
                  variant={isSettingsOpen ? 'secondary' : 'outline'}
                  size="sm"
                  title="Open settings"
                  onClick={() => setMainView('settings')}
                >
                  <Settings className="mr-2 size-4" />
                  Settings
                </Button>
                <div ref={toolsMenuRef} className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    title="Open tools menu"
                    aria-expanded={showToolsMenu}
                    onClick={() => setShowToolsMenu((current) => !current)}
                  >
                    <MoreHorizontal className="mr-2 size-4" />
                    Tools
                  </Button>
                  <AnimatePresence>
                    {showToolsMenu ? (
                      <motion.div
                        {...fadeScale}
                        className="glass-soft absolute right-0 top-full z-20 mt-2 w-[min(calc(100vw-2rem),18rem)] max-h-[60vh] overflow-y-auto rounded-md border border-border p-1"
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
                              className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
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
              </div>
            ) : null}
            </div>
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

          {selectedChat ? (
            <>
              <div className="flex-1 overflow-visible lg:min-h-0 lg:overflow-y-auto">
                <div className={joinClasses('mx-auto flex w-full gap-5 px-5 py-5', activeSource ? 'max-w-[1380px] xl:flex-row' : 'max-w-[1120px] flex-col')}>
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-5">
                  {selectedChat.summary ? (
                    <Card className="max-w-[56rem] shadow-none">
                      <CardHeader><CardTitle className="text-base">Conversation summary</CardTitle></CardHeader>
                      <CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedChat.summary}</p></CardContent>
                    </Card>
                  ) : null}

                  {branchInsights && (branchInsights.parent || branchInsights.children.length) ? (
                    <Card className="max-w-[56rem] border-border/70 bg-background/60 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <GitBranch className="size-4" />
                          Conversation branches
                        </CardTitle>
                        <CardDescription>See where this thread came from and what it has already spawned.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Parent</div>
                          {branchInsights.parent ? (
                            <button
                              type="button"
                              onClick={() => { setSelectedChatId(branchInsights.parent!.id); setMainView('chat') }}
                              className="mt-2 flex w-full items-center justify-between text-left"
                            >
                              <div>
                                <div className="text-sm font-medium">{branchInsights.parent.title}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{branchInsights.parent.messageCount} messages</div>
                              </div>
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </button>
                          ) : (
                            <div className="mt-2 text-sm text-muted-foreground">This is the root conversation.</div>
                          )}
                        </div>
                        <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Child branches</div>
                            <Badge variant="outline">{branchInsights.children.length}</Badge>
                          </div>
                          {branchInsights.children.length ? (
                            <div className="mt-2 space-y-2">
                              {branchInsights.children.slice(0, 3).map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => { setSelectedChatId(child.id); setMainView('chat') }}
                                  className="flex w-full items-center justify-between rounded-md border border-border/70 bg-background px-3 py-2 text-left hover:bg-muted"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{child.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{child.messageCount} messages</div>
                                  </div>
                                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-muted-foreground">No branches yet from this point.</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  <motion.div variants={subtleList} initial={false} animate="animate" className="flex w-full flex-col gap-5">
                    {!selectedChat.messages.length ? (
                      <motion.div
                        {...fadeUp}
                        className="max-w-[56rem] rounded-md border border-border bg-background/55 px-5 py-8 text-center"
                      >
                        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-muted">
                          <MessageSquare className="size-4" />
                        </div>
                        <div className="text-sm font-medium">No messages yet</div>
                        <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">
                          Ask the first question below. The answer will show up here with sources, follow-ups, and saved context.
                        </p>
                      </motion.div>
                    ) : null}
                    {selectedChat.messages.map((message, index) => (
                      <motion.section
                        key={message.id}
                        variants={fadeUp}
                        layout
                        className={joinClasses(
                          'premium-surface w-full overflow-hidden rounded-md border border-border px-5 py-4',
                          message.role === 'user'
                            ? 'ml-auto max-w-[34rem] bg-muted/80'
                            : 'max-w-[56rem] bg-background/70'
                        )}
                      >
                        {(() => {
                          const isStreamingMessage = message.role === 'assistant' && isSending && selectedChat.messages.at(-1)?.id === message.id
                          return (
                            <>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant={message.role === 'user' ? 'secondary' : 'outline'}>{message.role === 'user' ? 'You' : 'Assistant'}</Badge>
                          <span className="text-xs text-muted-foreground">{timeLabel(message.createdAt)}</span>
                          {message.editedAt ? <Badge variant="outline">Edited</Badge> : null}
                          {message.webSearchUsed ? <Badge variant="outline">Web</Badge> : null}
                          {confidenceLabel(message.confidence) ? <Badge variant="outline">{confidenceLabel(message.confidence)}</Badge> : null}
                          {isStreamingMessage ? <Badge variant="outline">Typing</Badge> : null}
                        </div>
                        {message.role === 'assistant' && sourceLayout === 'sources-first' && message.sources?.length ? (
                          <MessageSources
                            sources={message.sources}
                            onOpenSource={(source, sourceIndex) => openSourceViewer(message.id, source, sourceIndex)}
                          />
                        ) : null}
                        {message.role === 'assistant' ? (
                          message.content ? (
                            <div className={joinClasses('prose-answer', isStreamingMessage && 'streaming-answer')} aria-live={isStreamingMessage ? 'polite' : undefined}>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  a: ({ href, children, ...rest }) => {
                                    if (href?.startsWith('cite-')) {
                                      const idx = Number(href.slice(5))
                                      const source = message.sources?.[idx - 1]
                                      if (source) return <CitationInline source={source} index={idx} onOpenSource={(currentSource, sourceIndex) => openSourceViewer(message.id, currentSource, sourceIndex)} />
                                    }
                                    return <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>
                                  },
                                }}
                              >
                                {preprocessCitations(message.content, message.sources?.length ?? 0)}
                              </ReactMarkdown>
                            </div>
                          ) : isStreamingMessage ? (
                            <div className="streaming-indicator" aria-live="polite" aria-label="Assistant is typing">
                              <span />
                              <span />
                              <span />
                            </div>
                          ) : null
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                        )}
                        {message.contextUsed?.length ? (
                          <div className="mt-4 rounded-md border border-border bg-muted/45 px-3 py-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Sparkles className="size-3.5" />
                              Injected context
                            </div>
                            <ul className="space-y-1 text-xs text-muted-foreground">
                              {message.contextUsed.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                        ) : null}
                        {message.sources?.length && sourceLayout === 'answer-first'
                          ? <MessageSources sources={message.sources} onOpenSource={(source, sourceIndex) => openSourceViewer(message.id, source, sourceIndex)} />
                          : (message.role === 'assistant'
                              && isSending
                              && selectedChat.messages.at(-1)?.id === message.id
                              && (selectedChat.settings.useWebSearch ?? composerUseWebSearch)
                              ? <CitationsSkeleton />
                              : null)}
                        <div className="mt-4 flex max-w-full flex-wrap gap-2 overflow-hidden">
                          {message.role === 'user' ? (
                            <>
                              <Button variant="outline" size="sm" title="Edit and resend this message" onClick={() => { setEditingMessageId(message.id); setComposer(message.content); composerRef.current?.focus() }}>
                                <Pencil className="mr-2 size-3.5" />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" title="Branch a new chat from here" onClick={() => branchFromMessage(message.id).catch((error: Error) => setErrorMessage(error.message))}>
                                <GitBranch className="mr-2 size-3.5" />
                                Branch
                              </Button>
                              <Button variant="outline" size="sm" title="Copy message" onClick={() => copyToClipboard(message.content, `msg-${message.id}`)}>
                                {copiedKey === `msg-${message.id}` ? <Check className="mr-2 size-3.5" /> : <Copy className="mr-2 size-3.5" />}
                                {copiedKey === `msg-${message.id}` ? 'Copied' : 'Copy'}
                              </Button>
                            </>
                          ) : null}
                          {message.role === 'assistant' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Copy answer"
                              disabled={!message.content}
                              onClick={() => {
                                const sourcesBlock = message.sources?.length
                                  ? '\n\nSources:\n' + message.sources.map((s, i) => `[${i + 1}] ${s.title || safeHostname(s.url)} — ${s.url}`).join('\n')
                                  : ''
                                copyToClipboard(message.content + sourcesBlock, `msg-${message.id}`)
                              }}
                            >
                              {copiedKey === `msg-${message.id}` ? <Check className="mr-2 size-3.5" /> : <Copy className="mr-2 size-3.5" />}
                              {copiedKey === `msg-${message.id}` ? 'Copied' : 'Copy'}
                            </Button>
                          ) : null}
                          {message.role === 'assistant' && index === selectedChat.messages.length - 1 && !isSending ? (
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
                            </>
                          )
                        })()}
                      </motion.section>
                    ))}
                    <div ref={messagesEndRef} />
                  </motion.div>
                  </div>
                  </div>
                  {activeSource ? (
                    <aside className="w-full shrink-0 xl:sticky xl:top-5 xl:w-[340px] xl:self-start">
                      <Card className="border-border/70 bg-background shadow-none">
                        <CardHeader className="gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="text-base">Source {activeSource.index}</CardTitle>
                              <CardDescription className="mt-1 truncate">{safeHostname(activeSource.source.url)}</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon-sm" title="Close source panel" onClick={() => setActiveSource(null)}>
                              <X className="size-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => window.open(activeSource.source.url, '_blank', 'noopener,noreferrer')}>
                              <ExternalLink className="mr-2 size-3.5" />
                              Open source
                            </Button>
                            <Button
                              variant={sourceLayout === 'sources-first' ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => setSourceLayout((current) => current === 'answer-first' ? 'sources-first' : 'answer-first')}
                            >
                              <PanelRightOpen className="mr-2 size-3.5" />
                              {sourceLayout === 'answer-first' ? 'Sources first' : 'Answer first'}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                            <div className="text-sm font-medium leading-6">{activeSource.source.title || safeHostname(activeSource.source.url)}</div>
                            <div className="mt-2 text-xs text-muted-foreground">{activeSource.source.url}</div>
                          </div>
                          <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3 text-sm leading-6 text-muted-foreground">
                            {activeSource.source.content || 'No snippet was returned for this source, but the linked page is still attached to the answer.'}
                          </div>
                          <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Why it matters</div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              This panel keeps the evidence and the answer visible in one place, so users can verify claims without leaving the thread.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </aside>
                  ) : null}
                </div>
              </div>

              <div className="glass mobile-composer sticky bottom-0 z-20 mt-auto border-t border-border px-5 py-4">
                <div className="mx-auto w-full max-w-[1120px]">
                  <AnimatePresence>
                    {showUpgradePrompt ? (
                      <motion.div {...fadeScale} className="mb-3 rounded-md border border-border bg-background px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-medium">You’ve used today’s free messages.</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Upgrade to Premium for {moneyLabel(workspace?.user.billing.amountPaise ?? 100, workspace?.user.billing.currency ?? 'INR') ?? 'Rs 1/month'} and get a higher daily limit.
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
                    ref={composerRef}
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        if (editingMessageId) editAndResendMessage().catch((error: Error) => setErrorMessage(error.message))
                        else sendMessage().catch((error: Error) => setErrorMessage(error.message))
                      }
                    }}
                    placeholder={editingMessageId ? 'Update that earlier message and resend.' : 'Ask a follow-up. ⌘K new chat · ⌘/ focus · ↑ edit last · Esc stop. Shift+Enter for a new line.'}
                    className="min-h-[9rem] max-h-40 px-4 py-3"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {COMPOSER_COMMANDS.map((command) => {
                      const Icon = command.icon
                      return (
                        <Button
                          key={command.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          title={command.hint}
                          onClick={() => applyCommandChip(command.id)}
                        >
                          <Icon className="mr-2 size-3.5" />
                          {command.label}
                        </Button>
                      )
                    })}
                    <Badge variant="outline" className="h-8 px-3 text-[11px] sm:text-xs">
                      {ANSWER_STYLE_OPTIONS.find((option) => option.id === currentAnswerStyle)?.label ?? 'Structured'} mode
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:text-xs">
                      <label className="flex items-center gap-2">
                        <Globe className="size-3.5" />
                        <span>Web search for this message</span>
                        <Switch checked={composerUseWebSearch} onCheckedChange={setComposerUseWebSearch} ariaLabel="Web search for this message" />
                      </label>
                      <span>
                        {workspace?.usage.remainingToday === null
                          ? 'Unlimited messages available today'
                          : `${workspace?.usage.remainingToday ?? 0} messages left today`}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      {editingMessageId ? <Button className="h-11" variant="ghost" onClick={() => { setEditingMessageId(null); setComposer('') }}>Cancel</Button> : null}
                      {isSending ? (
                        <Button
                          className="h-11 flex-1 sm:flex-none"
                          variant="outline"
                          title="Stop generating (Esc)"
                          onClick={stopStreaming}
                        >
                          <Square className="mr-2 size-4 fill-current" />
                          Stop
                        </Button>
                      ) : (
                        <Button
                          className="h-11 flex-1 sm:flex-none"
                          disabled={!composer.trim()}
                          onClick={() => (
                            workspace?.usage.remainingToday === 0 && !workspace?.user.billing.isPremium
                              ? startPremiumCheckout().catch((error: Error) => setErrorMessage(error.message))
                              : (editingMessageId ? editAndResendMessage() : sendMessage()).catch((error: Error) => setErrorMessage(error.message))
                          )}
                        >
                          <Send className="mr-2 size-4" />
                          {workspace?.usage.remainingToday === 0 && !workspace?.user.billing.isPremium
                            ? 'Upgrade to send more'
                            : editingMessageId ? 'Update and resend' : 'Send'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md bg-muted"><MessageSquare className="size-5" /></div>
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

          <AnimatePresence>
            {isSettingsOpen ? (
              <>
                <motion.button
                  type="button"
                  aria-label="Close settings"
                  className="fixed inset-0 z-30 bg-background/75 anim-fade-in"
                  onClick={() => setMainView('chat')}
                />
                <motion.div
                  {...fadeScale}
                  className="fixed inset-0 z-40 flex items-stretch justify-center sm:items-start sm:p-6"
                >
                  <Card className="glass-strong relative flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 py-0 safe-top safe-bottom md:h-[calc(100dvh-4rem)] md:max-h-[680px] md:max-w-4xl md:flex-row md:rounded-md md:border md:border-border">
                    {/* Left rail */}
                    <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border/60 px-3 pt-3 pb-3 md:w-60 md:flex-col md:gap-0.5 md:overflow-x-visible md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:pt-4 md:pb-4">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hidden h-9 w-9 shrink-0 md:inline-flex"
                        title="Close settings"
                        onClick={() => setMainView('chat')}
                      >
                        <X className="size-4" />
                      </Button>
                      <div className="hidden md:mt-3 md:mb-2 md:block md:px-2 md:text-xs md:font-semibold md:uppercase md:tracking-[0.08em] md:text-muted-foreground">Settings</div>
                      {([
                        { id: 'profile' as const, label: 'Profile', icon: User },
                        { id: 'defaults' as const, label: 'Defaults', icon: Sliders },
                        { id: 'memory' as const, label: 'Memory', icon: Brain },
                        { id: 'chat' as const, label: 'Current chat', icon: MessageSquare },
                        { id: 'data' as const, label: 'Data & usage', icon: Database },
                        { id: 'premium' as const, label: 'Billing', icon: CreditCard },
                      ]).map((item) => {
                        const Icon = item.icon
                        const active = settingsSection === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSettingsSection(item.id)}
                            className={joinClasses(
                              'group/rail flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                              active
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                              'md:w-full md:justify-start'
                            )}
                          >
                            <Icon className={joinClasses('size-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground group-hover/rail:text-foreground')} />
                            <span>{item.label}</span>
                          </button>
                        )
                      })}
                      <div className="ml-auto md:hidden">
                        <Button variant="ghost" size="icon-sm" className="h-9 w-9 shrink-0" title="Close settings" onClick={() => setMainView('chat')}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </aside>

                    {/* Right pane */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-baseline justify-between gap-3 border-b border-border/60 px-5 pt-5 pb-4 md:px-7 md:pt-6 md:pb-5">
                        <div>
                          <h2 className="text-lg font-semibold tracking-tight">{
                            settingsSection === 'profile' ? 'Profile'
                              : settingsSection === 'defaults' ? 'Defaults'
                              : settingsSection === 'memory' ? 'Memory'
                              : settingsSection === 'chat' ? 'Current chat'
                              : settingsSection === 'data' ? 'Data & usage'
                              : 'Billing'
                          }</h2>
                          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{
                            settingsSection === 'profile' ? 'Manage your public identity and profile details.'
                              : settingsSection === 'defaults' ? 'Set how new chats should behave before you start typing.'
                              : settingsSection === 'memory' ? 'Keep reusable context tidy, editable, and easy to trust.'
                              : settingsSection === 'chat' ? 'Settings that apply only to the chat you have open right now.'
                              : settingsSection === 'data' ? 'Track your quota and manage the data we store for your workspace.'
                              : 'Plan, status, and subscription management.'
                          }</p>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
                      <div className="space-y-6">
                        {settingsSection === 'profile' ? (
                        <section className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
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
                            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border border-border bg-background/50 px-3 py-3 text-xs text-muted-foreground">
                              <div>
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
                          </div>
                        </section>
                        ) : null}

                        {settingsSection === 'defaults' ? (
                        <section className="space-y-4">
                          <div className="grid gap-3 lg:grid-cols-3">
                            {ANSWER_STYLE_OPTIONS.map((option) => {
                              const Icon = option.icon
                              const active = defaultAnswerStyle === option.id
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setPreferenceForm((current) => applyAnswerStylePreset(current, option.id))}
                                  className={joinClasses(
                                    'rounded-md border px-4 py-4 text-left transition-colors',
                                    active ? 'border-foreground bg-muted' : 'border-border bg-background hover:bg-muted/60',
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="size-4 text-muted-foreground" />
                                    <div className="text-sm font-medium">{option.label}</div>
                                  </div>
                                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</div>
                                </button>
                              )
                            })}
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Roast level</label>
                              <Select value={preferenceForm.roastLevel} onChange={(event) => setPreferenceForm((current) => ({ ...current, roastLevel: event.target.value as PreferenceRecord['roastLevel'] }))}>
                                <option value="light">Light</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Response length</label>
                              <Select value={preferenceForm.responseLength} onChange={(event) => setPreferenceForm((current) => ({ ...current, responseLength: event.target.value as PreferenceRecord['responseLength'] }))}>
                                <option value="short">Short</option>
                                <option value="medium">Medium</option>
                                <option value="long">Long</option>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Format</label>
                              <Select value={preferenceForm.outputFormat} onChange={(event) => setPreferenceForm((current) => ({ ...current, outputFormat: event.target.value as PreferenceRecord['outputFormat'] }))}>
                                <option value="bullets">Bullets</option>
                                <option value="paragraphs">Paragraphs</option>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Answer mode</label>
                              <Select value={preferenceForm.answerMode} onChange={(event) => setPreferenceForm((current) => ({ ...current, answerMode: event.target.value as PreferenceRecord['answerMode'] }))}>
                                <option value="fast">Fast</option>
                                <option value="balanced">Balanced</option>
                                <option value="deep">Deep research</option>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Model</label>
                              <Select value={preferenceForm.preferredModel} onChange={(event) => setPreferenceForm((current) => ({ ...current, preferredModel: event.target.value }))}>
                                {MODEL_OPTIONS.map((model) => <option key={model} value={model}>{model}</option>)}
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Default folder</label>
                              <Select value={preferenceForm.defaultFolderId ?? 'none'} onChange={(event) => setPreferenceForm((current) => ({ ...current, defaultFolderId: event.target.value === 'none' ? null : event.target.value }))}>
                                <option value="none">None</option>
                                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                              </Select>
                            </div>
                            <label className="flex items-center justify-between gap-3 border border-border bg-background/50 px-3 py-3 text-sm md:col-span-2">
                              <span>Only answer from sources by default</span>
                              <Switch checked={preferenceForm.onlyFromSources} onCheckedChange={(checked) => setPreferenceForm((current) => ({ ...current, onlyFromSources: checked }))} ariaLabel="Only answer from sources by default" />
                            </label>
                            <div className="md:col-span-2 flex justify-end">
                              <Button disabled={isSavingPreferences} onClick={() => savePreferences().catch((error: Error) => setErrorMessage(error.message))}>
                                {isSavingPreferences ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                Save defaults
                              </Button>
                            </div>
                          </div>
                        </section>
                        ) : null}

                        {settingsSection === 'memory' ? (
                        <section className="space-y-5">
                          <Card className="border-border/70 bg-background/55 shadow-none">
                            <CardHeader>
                              <CardTitle className="text-base">Reusable memory</CardTitle>
                              <CardDescription>Store stable facts, preferences, and instructions you want the assistant to reuse across chats.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex gap-2">
                                <Input
                                  value={draftMemoryItem}
                                  onChange={(event) => setDraftMemoryItem(event.target.value)}
                                  placeholder="Example: Prefer concise answers with implementation details."
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      addMemoryItem()
                                    }
                                  }}
                                />
                                <Button type="button" onClick={addMemoryItem}>
                                  <Plus className="mr-2 size-4" />
                                  Add
                                </Button>
                              </div>
                              <div className="grid gap-2">
                                {memoryItems.length ? memoryItems.map((item) => (
                                  <div key={item} className="flex items-start justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-4 py-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium">{item}</div>
                                      <div className="mt-1 text-xs text-muted-foreground">Injected into future answers as reusable context.</div>
                                    </div>
                                    <Button variant="ghost" size="icon-xs" title="Remove memory item" onClick={() => removeMemoryItem(item)}>
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                )) : (
                                  <div className="rounded-md border border-dashed border-border bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                                    No reusable memory saved yet. Add a few durable preferences, not temporary task notes.
                                  </div>
                                )}
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Raw memory notes</label>
                                <Textarea value={preferenceForm.memoryNotes} onChange={(event) => setPreferenceForm((current) => ({ ...current, memoryNotes: event.target.value }))} className="min-h-28" />
                              </div>
                              <div className="flex justify-end">
                                <Button disabled={isSavingPreferences} onClick={() => savePreferences().catch((error: Error) => setErrorMessage(error.message))}>
                                  {isSavingPreferences ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                  Save memory
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </section>
                        ) : null}

                        {settingsSection === 'chat' ? (
                        <section className="space-y-4">
                          {selectedChat ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="grid gap-3 md:col-span-2 lg:grid-cols-3">
                                {ANSWER_STYLE_OPTIONS.map((option) => {
                                  const Icon = option.icon
                                  const active = currentAnswerStyle === option.id
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => setChatSettingsForm((current) => applyAnswerStylePreset(current, option.id))}
                                      className={joinClasses(
                                        'rounded-md border px-4 py-4 text-left transition-colors',
                                        active ? 'border-foreground bg-muted' : 'border-border bg-background hover:bg-muted/60',
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Icon className="size-4 text-muted-foreground" />
                                        <div className="text-sm font-medium">{option.label}</div>
                                      </div>
                                      <div className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</div>
                                    </button>
                                  )
                                })}
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Folder</label>
                                <Select value={currentFolderId ?? 'none'} onChange={(event) => moveChatToFolder(event.target.value === 'none' ? null : event.target.value).catch((error: Error) => setErrorMessage(error.message))}>
                                  <option value="none">Unfiled</option>
                                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Mode</label>
                                <Select value={chatSettingsForm.answerMode} onChange={(event) => setChatSettingsForm((current) => ({ ...current, answerMode: event.target.value as ChatSettings['answerMode'] }))}>
                                  <option value="fast">Fast</option>
                                  <option value="balanced">Balanced</option>
                                  <option value="deep">Deep research</option>
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Model</label>
                                <Select value={chatSettingsForm.preferredModel} onChange={(event) => setChatSettingsForm((current) => ({ ...current, preferredModel: event.target.value }))}>
                                  {MODEL_OPTIONS.map((model) => <option key={model} value={model}>{model}</option>)}
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Roast level</label>
                                <Select value={chatSettingsForm.roastLevel} onChange={(event) => setChatSettingsForm((current) => ({ ...current, roastLevel: event.target.value as ChatSettings['roastLevel'] }))}>
                                  <option value="light">Light</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Response length</label>
                                <Select value={chatSettingsForm.responseLength} onChange={(event) => setChatSettingsForm((current) => ({ ...current, responseLength: event.target.value as ChatSettings['responseLength'] }))}>
                                  <option value="short">Short</option>
                                  <option value="medium">Medium</option>
                                  <option value="long">Long</option>
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Output format</label>
                                <Select value={chatSettingsForm.outputFormat} onChange={(event) => setChatSettingsForm((current) => ({ ...current, outputFormat: event.target.value as ChatSettings['outputFormat'] }))}>
                                  <option value="bullets">Bullets</option>
                                  <option value="paragraphs">Paragraphs</option>
                                </Select>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Context budget</label>
                                <Input type="number" min={4} max={20} value={chatSettingsForm.contextWindow} onChange={(event) => setChatSettingsForm((current) => ({ ...current, contextWindow: Number(event.target.value || 12) }))} />
                              </div>
                              <label className="flex items-center justify-between gap-3 border border-border bg-background/50 px-3 py-3 text-sm">
                                <span>Default web search on</span>
                                <Switch checked={chatSettingsForm.useWebSearch} onCheckedChange={(checked) => setChatSettingsForm((current) => ({ ...current, useWebSearch: checked }))} ariaLabel="Default web search on" />
                              </label>
                              <label className="flex items-center justify-between gap-3 border border-border bg-background/50 px-3 py-3 text-sm">
                                <span>Only answer from sources</span>
                                <Switch checked={chatSettingsForm.onlyFromSources} onCheckedChange={(checked) => setChatSettingsForm((current) => ({ ...current, onlyFromSources: checked }))} ariaLabel="Only answer from sources" />
                              </label>
                              <label className="flex items-center justify-between gap-3 border border-border bg-background/50 px-3 py-3 text-sm">
                                <span>Source cards before answer</span>
                                <Switch checked={sourceLayout === 'sources-first'} onCheckedChange={(checked) => setSourceLayout(checked ? 'sources-first' : 'answer-first')} ariaLabel="Show sources before answer" />
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
                            </div>
                          ) : (
                            <div className="border border-border bg-background/50 px-3 py-3 text-sm text-muted-foreground">
                              Open a chat first. Then its per-chat controls will show up here.
                            </div>
                          )}
                        </section>
                        ) : null}

                        {settingsSection === 'data' ? (
                        <section className="space-y-5">
                          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
                            <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                              <CardContent className="grid gap-5 px-5 py-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Quota overview</div>
                                    <div className="mt-2 text-3xl font-semibold tracking-tight">
                                      {usageOverview.remainingToday === null ? 'Unlimited' : usageOverview.remainingToday}
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                      {usageOverview.remainingToday === null
                                        ? 'No daily cap on this plan.'
                                        : `${usageOverview.sentToday} sent today out of ${usageOverview.dailyLimit ?? usageOverview.sentToday}.`}
                                    </div>
                                  </div>
                                  <Badge variant="outline">
                                    {workspace?.user.billing.isPremium ? 'Premium' : 'Free'}
                                  </Badge>
                                </div>

                                <div className="space-y-2">
                                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                                      style={{ width: `${((usageOverview.quotaRatio ?? 0) * 100) || 4}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Usage today</span>
                                    <span>{usageOverview.dailyLimit === null ? 'Unmetered' : `${Math.round((usageOverview.quotaRatio ?? 0) * 100)}% used`}</span>
                                  </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                                    <div className="text-xs text-muted-foreground">Sent today</div>
                                    <div className="mt-1 text-2xl font-semibold">{usageOverview.sentToday}</div>
                                  </div>
                                  <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                                    <div className="text-xs text-muted-foreground">Recoverable chats</div>
                                    <div className="mt-1 text-2xl font-semibold">{usageOverview.deletedRecoverableCount}</div>
                                  </div>
                                  <div className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                                    <div className="text-xs text-muted-foreground">Logged events</div>
                                    <div className="mt-1 text-2xl font-semibold">{usageOverview.totalLoggedEvents}</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                              <CardHeader>
                                <CardTitle className="text-base">Workspace pulse</CardTitle>
                                <CardDescription>Recent activity patterns across prompts, replies, and chat creation.</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-5">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="rounded-md border border-border/70 bg-background/60 px-3 py-3">
                                    <div className="text-[11px] text-muted-foreground">Prompts</div>
                                    <div className="mt-1 text-xl font-semibold">{usageOverview.userPrompts}</div>
                                  </div>
                                  <div className="rounded-md border border-border/70 bg-background/60 px-3 py-3">
                                    <div className="text-[11px] text-muted-foreground">Replies</div>
                                    <div className="mt-1 text-xl font-semibold">{usageOverview.assistantReplies}</div>
                                  </div>
                                  <div className="rounded-md border border-border/70 bg-background/60 px-3 py-3">
                                    <div className="text-[11px] text-muted-foreground">Chats</div>
                                    <div className="mt-1 text-xl font-semibold">{usageOverview.chatsCreated}</div>
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Last 7 days</div>
                                  <div className="grid h-28 grid-cols-7 items-end gap-2">
                                    {usageOverview.recentDays.map((day) => (
                                      <div key={day.key} className="flex min-h-0 flex-col items-center justify-end gap-2">
                                        <div className="flex h-20 w-full items-end">
                                          <div
                                            className="w-full rounded-sm bg-primary/80"
                                            style={{ height: `${Math.max(8, Math.round((day.count / usageOverview.peakDayCount) * 100))}%` }}
                                            title={`${day.count} events`}
                                          />
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">{day.label}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {usageDashboard ? (
                            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                              <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2 text-base">
                                    <BarChart3 className="size-4" />
                                    Insights snapshot
                                  </CardTitle>
                                  <CardDescription>High-level product signals that help users understand how they work here.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                  {[
                                    { label: 'Avg/chat', value: usageDashboard.averageMessagesPerChat },
                                    { label: 'Pinned', value: usageDashboard.pinnedChats },
                                    { label: 'Branches', value: usageDashboard.branchChats },
                                    { label: 'Sourced replies', value: usageDashboard.sourcedReplies },
                                  ].map((metric) => (
                                    <div key={metric.label} className="rounded-md border border-border/70 bg-background/60 px-4 py-3">
                                      <div className="text-[11px] text-muted-foreground">{metric.label}</div>
                                      <div className="mt-1 text-xl font-semibold">{metric.value}</div>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>

                              <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2 text-base">
                                    <Network className="size-4" />
                                    Source intelligence
                                  </CardTitle>
                                  <CardDescription>Which domains and topics are driving the workspace most often.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Top domains</div>
                                    <div className="space-y-2">
                                      {usageDashboard.topSourceDomains.length ? usageDashboard.topSourceDomains.map((item) => (
                                        <div key={item.domain} className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
                                          <div className="truncate text-sm">{item.domain}</div>
                                          <Badge variant="outline">{item.count}</Badge>
                                        </div>
                                      )) : (
                                        <div className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                                          No source domains yet. This fills in once more web-backed answers land.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Recurring topics</div>
                                    <div className="flex flex-wrap gap-2">
                                      {usageDashboard.topTopics.length ? usageDashboard.topTopics.map((topic) => (
                                        <Badge key={topic.label} variant="outline">{normalizeTopicLabel(topic.label)} · {topic.count}</Badge>
                                      )) : (
                                        <div className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                                          Topic clustering grows as more chats accumulate.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          ) : isLoadingUsageDashboard ? (
                            <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                              <CardContent className="grid gap-4 px-5 py-5 md:grid-cols-3">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                              </CardContent>
                            </Card>
                          ) : null}

                          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                            <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                              <CardHeader>
                                <CardTitle className="text-base">Recent activity</CardTitle>
                                <CardDescription>The latest workspace events, translated into something easier to scan.</CardDescription>
                              </CardHeader>
                              <CardContent className="px-0">
                                <div className="divide-y divide-border/70">
                                  {(usageDashboard?.activity ?? usageActivity).slice(0, 8).map((item) => (
                                    <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                                      <div className={joinClasses('mt-0.5 rounded-full border px-2 py-1 text-[11px] font-medium', activityAccentClass(item.type))}>
                                        {item.type.split('.').at(0)}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                          <div className="text-sm font-medium">{formatActivityTypeLabel(item.type)}</div>
                                          <div className="text-xs text-muted-foreground">{timeLabel(item.createdAt)}</div>
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                          {summarizeActivity(item)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {!(usageDashboard?.activity ?? usageActivity).length ? (
                                    <div className="px-5 py-8 text-sm text-muted-foreground">
                                      Activity will show up here once the workspace starts recording usage events.
                                    </div>
                                  ) : null}
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                              <CardHeader>
                                <CardTitle className="text-base">Workspace leaders</CardTitle>
                                <CardDescription>Chats and folders carrying the most activity right now.</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-2">
                                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Top chats</div>
                                  {(usageDashboard?.topChats ?? []).map((chat) => (
                                    <button
                                      key={chat.id}
                                      type="button"
                                      onClick={() => { setSelectedChatId(chat.id); setMainView('chat') }}
                                      className="flex w-full items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-3 text-left hover:bg-muted"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{chat.title}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{chat.messageCount} messages · Updated {timeLabel(chat.updatedAt)}</div>
                                      </div>
                                      {chat.branchFromChatId ? <GitBranch className="size-4 shrink-0 text-muted-foreground" /> : null}
                                    </button>
                                  ))}
                                </div>
                                <div className="space-y-2">
                                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Top folders</div>
                                  {(usageDashboard?.topFolders ?? []).length ? (usageDashboard?.topFolders ?? []).map((folder) => (
                                    <div key={folder.id} className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-3 py-2">
                                      <div className="truncate text-sm">{folder.name}</div>
                                      <Badge variant="outline">{folder.chatCount}</Badge>
                                    </div>
                                  )) : (
                                    <div className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                                      Folder leaders appear here once chats are filed.
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <Card className="overflow-hidden border-border/70 bg-background/55 shadow-none">
                            <CardHeader>
                              <CardTitle className="text-base">Data controls</CardTitle>
                              <CardDescription>Take your data with you, or clear stored workspace history entirely.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-md border border-border/70 bg-background/60 px-4 py-4">
                                <div className="text-sm font-medium">Export workspace data</div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Download your chats, settings, and saved workspace records as JSON.
                                </p>
                                <Button className="mt-4" variant="outline" disabled={isExportingData} onClick={() => exportStoredData().catch((error: Error) => setErrorMessage(error.message))}>
                                  {isExportingData ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                                  Export data
                                </Button>
                              </div>

                              <div className="rounded-md border border-destructive/25 bg-destructive/6 px-4 py-4 dark:border-destructive/30 dark:bg-destructive/8">
                                <div className="text-sm font-medium text-foreground">Delete stored data</div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Remove chats, folders, and stored workspace records for this account.
                                </p>
                                <Button className="mt-4" variant="destructive" disabled={isDeletingData} onClick={() => deleteStoredData().catch((error: Error) => setErrorMessage(error.message))}>
                                  {isDeletingData ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                                  Delete stored data
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </section>
                        ) : null}

                        {settingsSection === 'premium' ? (
                        <section className="space-y-4">
                          <p className="text-xs text-muted-foreground">
                            Free includes {dailyLimitLabel(workspace?.user.billing.dailyMessageLimit ?? 2)}. Premium raises the daily limit and stays tied to verified server billing state.
                          </p>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="border border-border bg-background/50 px-4 py-3">
                              <div className="text-xs text-muted-foreground">Plan</div>
                              <div className="mt-1 text-lg font-semibold">{workspace?.user.billing.planName ?? 'Free'}</div>
                            </div>
                            <div className="border border-border bg-background/50 px-4 py-3">
                              <div className="text-xs text-muted-foreground">Status</div>
                              <div className="mt-1 text-lg font-semibold capitalize">{workspace?.user.billing.status ?? 'inactive'}</div>
                            </div>
                            <div className="border border-border bg-background/50 px-4 py-3">
                              <div className="text-xs text-muted-foreground">Daily limit</div>
                              <div className="mt-1 text-lg font-semibold">{dailyLimitLabel(workspace?.user.billing.dailyMessageLimit ?? 2)}</div>
                            </div>
                          </div>
                          <div className="grid gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                              <span>Price</span>
                              <span>{moneyLabel(workspace?.user.billing.amountPaise ?? 100, workspace?.user.billing.currency ?? 'INR') ?? 'Rs 1 / month'}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
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
                        </section>
                        ) : null}
                      </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { isLoaded, userId } = useAuth()
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname))
  const [themeTransition, setThemeTransition] = useState<{
    x: number
    y: number
    size: number
    nextTheme: ThemeMode
    isVisible: boolean
  } | null>(null)
  const themeTransitionTimersRef = useRef<number[]>([])

  useEffect(() => {
    const saved = (window.localStorage.getItem('poorplexity-theme') as ThemeMode | null) ?? 'dark'
    setTheme(saved)
    document.documentElement.classList.toggle('dark', saved === 'dark')
    const onPopState = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const clearThemeTransitionTimers = () => {
    themeTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    themeTransitionTimersRef.current = []
  }

  useEffect(() => {
    return () => clearThemeTransitionTimers()
  }, [])

  const applyTheme = (next: ThemeMode) => {
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    window.localStorage.setItem('poorplexity-theme', next)
  }

  const toggleTheme = (origin?: ThemeToggleOrigin) => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    clearThemeTransitionTimers()

    if (!origin || reduceMotion) {
      setThemeTransition(null)
      applyTheme(next)
      return
    }

    const maxHorizontal = Math.max(origin.x, window.innerWidth - origin.x)
    const maxVertical = Math.max(origin.y, window.innerHeight - origin.y)
    const size = Math.ceil(Math.hypot(maxHorizontal, maxVertical) * 2)

    setThemeTransition({
      x: origin.x,
      y: origin.y,
      size,
      nextTheme: next,
      isVisible: false,
    })

    const rafId = window.requestAnimationFrame(() => {
      setThemeTransition((current) => current ? { ...current, isVisible: true } : current)
    })

    const applyTimer = window.setTimeout(() => {
      applyTheme(next)
    }, 460)

    const cleanupTimer = window.setTimeout(() => {
      setThemeTransition(null)
    }, 560)

    themeTransitionTimersRef.current = [applyTimer, cleanupTimer]
    window.setTimeout(() => window.cancelAnimationFrame(rafId), 0)
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
      {themeTransition ? (
        <div
          aria-hidden="true"
          className="theme-transition-overlay"
          data-next-theme={themeTransition.nextTheme}
          style={{
            width: `${themeTransition.size}px`,
            height: `${themeTransition.size}px`,
            left: `${themeTransition.x - themeTransition.size / 2}px`,
            top: `${themeTransition.y - themeTransition.size / 2}px`,
            transform: themeTransition.isVisible ? 'scale(1)' : 'scale(0)',
            opacity: themeTransition.isVisible ? 1 : 0.98,
          }}
        />
      ) : null}
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
