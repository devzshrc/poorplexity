export type ThemeMode = 'light' | 'dark'
export type RouteState = { kind: 'workspace' } | { kind: 'profile'; username: string } | { kind: 'sso-callback' }

export type PreferenceRecord = {
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

export type BillingRecord = {
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

export type UsageActivity = {
  id: string
  type: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type FolderRecord = {
  id: string
  name: string
  parentFolderId: string | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

export type Source = {
  url: string
  title: string
  content: string
}

export type ChatSettings = {
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

export type ChatMessage = {
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

export type ChatSummary = {
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

export type ChatDetail = ChatSummary & {
  settings: ChatSettings
  summary: string
  deletedAt: string | null
  restoreUntil: string | null
  messages: ChatMessage[]
}

export type SearchResultPayload = {
  chats: ChatSummary[]
  messages: Array<ChatMessage & { chatId: string; chatTitle: string }>
}

export type UsagePayload = {
  sentToday: number
  remainingToday: number | null
  dailyLimit: number | null
  deletedRecoverableCount: number
  activity: UsageActivity[]
}

export type WorkspacePayload = {
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

export type PublicProfilePayload = {
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

export type BillingCheckoutPayload = {
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

export type UsageDashboardPayload = {
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

export type SSEHandlers = {
  onSources: (sources: Source[]) => void
  onAnswer: (chunk: string) => void
  onFollowUps: (items: string[]) => void
  onChat: (chat: ChatSummary) => void
  onContext: (items: string[]) => void
  onConfidence: (value: number) => void
  onDone: () => void
  onError: (message: string) => void
}

export type ApiErrorPayload = {
  error?: string
  code?: string
  details?: unknown
}
