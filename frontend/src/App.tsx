import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ClerkLoaded, ClerkLoading, useAuth, useClerk } from '@clerk/react'
import {
  AlertCircle,
  Check,
  Folder,
  FolderPlus,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Settings,
  Trash2,
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

type FolderRecord = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

type Source = {
  url: string
  title: string
  content: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  sources?: Source[]
  followUps?: string[]
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
}

type ChatDetail = ChatSummary & {
  messages: ChatMessage[]
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
  }
  folders: FolderRecord[]
  chats: ChatSummary[]
}

type SSEHandlers = {
  onSources: (sources: Source[]) => void
  onAnswer: (chunk: string) => void
  onFollowUps: (items: string[]) => void
  onChat: (chat: ChatSummary) => void
  onDone: () => void
  onError: (message: string) => void
}

type FilterValue = 'all' | 'unfiled' | string
type MainView = 'chat' | 'settings'

function safeHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
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
        else if (event === 'done') handlers.onDone()
        else if (event === 'error') handlers.onError((data as { message: string }).message)
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!signal.aborted) handlers.onDone()
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function MessageSources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {sources.slice(0, 4).map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-muted/60"
        >
          <div className="line-clamp-2 font-medium">{source.title || safeHostname(source.url)}</div>
          <div className="mt-1 truncate text-muted-foreground">{safeHostname(source.url)}</div>
        </a>
      ))}
    </div>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="h-dvh overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-3 h-9 w-full" />
          <Skeleton className="mt-6 h-20 w-full" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
        <div className="rounded-lg border border-border p-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-24 w-full" />
          <Skeleton className="mt-4 h-24 w-4/5" />
          <Skeleton className="mt-8 h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

function AuthGate() {
  const clerk = useClerk()
  const redirectUrl = useMemo(
    () => (typeof window === 'undefined' ? '/' : window.location.origin),
    [],
  )

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <Card className="w-full border-border/80 shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                <Lock className="size-4" />
              </div>
              <div>
                <CardTitle className="text-xl tracking-tight">Sign in to poorplexity</CardTitle>
                <CardDescription>
                  Clean auth, persistent chats, no weird hand-rolled login nonsense.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              className="h-11 w-full"
              onClick={() => clerk.redirectToSignIn({ signInFallbackRedirectUrl: redirectUrl })}
            >
              Sign in
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => clerk.redirectToSignUp({ signUpFallbackRedirectUrl: redirectUrl })}
            >
              Create account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Workspace() {
  const { getToken } = useAuth()
  const clerk = useClerk()
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null)
  const [chatCache, setChatCache] = useState<Record<string, ChatDetail>>({})
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all')
  const [composer, setComposer] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [isBooting, setIsBooting] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [mainView, setMainView] = useState<MainView>('chat')
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    imageUrl: '',
    bio: '',
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isDeletingData, setIsDeletingData] = useState(false)
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
    }

    const payload = await res.json() as WorkspacePayload
    setWorkspace(payload)
    setSelectedChatId((current) => {
      if (preserveSelection && current && payload.chats.some((chat) => chat.id === current)) {
        return current
      }
      return payload.chats[0]?.id ?? null
    })
  }

  const loadChat = async (chatId: string) => {
    const res = await authorizedFetch(`/api/chats/${chatId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
    }

    const payload = await res.json() as { chat: ChatDetail }
    setChatCache((current) => ({ ...current, [chatId]: payload.chat }))
    return payload.chat
  }

  useEffect(() => {
    let cancelled = false

    setIsBooting(true)
    loadWorkspace(false)
      .catch((error: Error) => {
        if (!cancelled) setErrorMessage(error.message)
      })
      .finally(() => {
        if (!cancelled) setIsBooting(false)
      })

    return () => {
      cancelled = true
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
    })
  }, [workspace?.user.displayName, workspace?.user.imageUrl, workspace?.user.bio])

  const folders = workspace?.folders ?? []
  const chats = workspace?.chats ?? []
  const selectedChat = selectedChatId ? chatCache[selectedChatId] ?? null : null
  const currentFolderId = selectedChat?.folderId ?? null
  const userInitial = (workspace?.user.displayName || 'P').trim().charAt(0).toUpperCase()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [selectedChatId, selectedChat?.messages.length])

  const groupedChats = useMemo(() => {
    const next = new Map<string | null, ChatSummary[]>()
    for (const chat of chats) {
      const list = next.get(chat.folderId) ?? []
      list.push(chat)
      next.set(chat.folderId, list)
    }
    return next
  }, [chats])

  const visibleChats = chats.filter((chat) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'unfiled') return chat.folderId === null
    return chat.folderId === activeFilter
  })

  const createNewChat = async (firstMessage?: string) => {
    setIsCreatingChat(true)
    try {
      const res = await authorizedFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstMessage,
          folderId: activeFilter !== 'all' && activeFilter !== 'unfiled' ? activeFilter : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const payload = await res.json() as { chat: ChatSummary }
      setWorkspace((current) => current ? {
        ...current,
        chats: [payload.chat, ...current.chats.filter((chat) => chat.id !== payload.chat.id)],
      } : current)
      setChatCache((current) => ({
        ...current,
        [payload.chat.id]: {
          ...payload.chat,
          messages: [],
        },
      }))
      setSelectedChatId(payload.chat.id)
      setMainView('chat')
      return payload.chat.id
    } finally {
      setIsCreatingChat(false)
    }
  }

  const createFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return

    setIsCreatingFolder(true)
    try {
      const res = await authorizedFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const payload = await res.json() as { folder: FolderRecord }
      setWorkspace((current) => current ? { ...current, folders: [...current.folders, payload.folder] } : current)
      setNewFolderName('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const moveChatToFolder = async (folderId: string | null) => {
    if (!selectedChatId) return

    try {
      const res = await authorizedFetch(`/api/chats/${selectedChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const payload = await res.json() as { chat: ChatSummary }
      setWorkspace((current) => current ? {
        ...current,
        chats: current.chats.map((chat) => chat.id === payload.chat.id ? payload.chat : chat),
      } : current)
      setChatCache((current) => current[selectedChatId]
        ? { ...current, [selectedChatId]: { ...current[selectedChatId], folderId: payload.chat.folderId } }
        : current)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const saveChatTitle = async () => {
    if (!selectedChatId) return
    const title = draftTitle.trim()
    if (!title) return

    try {
      const res = await authorizedFetch(`/api/chats/${selectedChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const payload = await res.json() as { chat: ChatSummary }
      setWorkspace((current) => current ? {
        ...current,
        chats: current.chats.map((chat) => chat.id === payload.chat.id ? payload.chat : chat),
      } : current)
      setChatCache((current) => current[selectedChatId]
        ? { ...current, [selectedChatId]: { ...current[selectedChatId], title: payload.chat.title } }
        : current)
      setEditingTitle(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const removeChat = async (chatId: string) => {
    try {
      const res = await authorizedFetch(`/api/chats/${chatId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      setWorkspace((current) => current ? {
        ...current,
        chats: current.chats.filter((chat) => chat.id !== chatId),
      } : current)
      setChatCache((current) => {
        const next = { ...current }
        delete next[chatId]
        return next
      })
      setSelectedChatId((current) => {
        if (current !== chatId) return current
        const nextChat = chats.find((chat) => chat.id !== chatId)
        return nextChat?.id ?? null
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const removeFolder = async (folderId: string) => {
    try {
      const res = await authorizedFetch(`/api/folders/${folderId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      setWorkspace((current) => current ? {
        ...current,
        folders: current.folders.filter((folder) => folder.id !== folderId),
        chats: current.chats.map((chat) => chat.folderId === folderId ? { ...chat, folderId: null } : chat),
      } : current)
      setChatCache((current) => {
        const next: Record<string, ChatDetail> = {}
        for (const [key, chat] of Object.entries(current)) {
          next[key] = chat.folderId === folderId ? { ...chat, folderId: null } : chat
        }
        return next
      })
      if (activeFilter === folderId) setActiveFilter('all')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const sendMessage = async (seed?: string) => {
    const content = (seed ?? composer).trim()
    if (!content || isSending) return

    setComposer('')
    setErrorMessage('')
    setIsSending(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      let chatId = selectedChatId
      if (!chatId) chatId = await createNewChat(content)
      if (!chatId) throw new Error('Unable to create a chat.')

      const now = new Date().toISOString()
      const optimisticUser: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        createdAt: now,
      }
      const optimisticAssistant: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        createdAt: now,
      }

      setChatCache((current) => {
        const previous = current[chatId!]
        if (!previous) return current
        return {
          ...current,
          [chatId!]: {
            ...previous,
            messages: [...previous.messages, optimisticUser, optimisticAssistant],
            updatedAt: now,
            lastMessageAt: now,
          },
        }
      })

      const res = await authorizedFetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      await consumeStream(res, {
        onSources: (sources) => {
          setChatCache((current) => {
            const chat = current[chatId!]
            if (!chat) return current
            const messages = [...chat.messages]
            const last = messages.at(-1)
            if (!last || last.role !== 'assistant') return current
            messages[messages.length - 1] = { ...last, sources }
            return { ...current, [chatId!]: { ...chat, messages } }
          })
        },
        onAnswer: (chunk) => {
          setChatCache((current) => {
            const chat = current[chatId!]
            if (!chat) return current
            const messages = [...chat.messages]
            const last = messages.at(-1)
            if (!last || last.role !== 'assistant') return current
            messages[messages.length - 1] = { ...last, content: last.content + chunk }
            return { ...current, [chatId!]: { ...chat, messages } }
          })
        },
        onFollowUps: (items) => {
          setChatCache((current) => {
            const chat = current[chatId!]
            if (!chat) return current
            const messages = [...chat.messages]
            const last = messages.at(-1)
            if (!last || last.role !== 'assistant') return current
            messages[messages.length - 1] = { ...last, followUps: items }
            return { ...current, [chatId!]: { ...chat, messages } }
          })
        },
        onChat: (chat) => {
          setWorkspace((current) => current ? {
            ...current,
            chats: [chat, ...current.chats.filter((item) => item.id !== chat.id)],
          } : current)
        },
        onDone: () => {},
        onError: (message) => {
          setErrorMessage(message)
        },
      }, controller.signal)

      await Promise.all([loadWorkspace(), loadChat(chatId)])
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setErrorMessage(error instanceof Error ? error.message : String(error))
      }
    } finally {
      setIsSending(false)
    }
  }

  if (isBooting) {
    return <WorkspaceSkeleton />
  }

  const saveProfile = async () => {
    setIsSavingProfile(true)
    setErrorMessage('')
    try {
      const res = await authorizedFetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const payload = await res.json() as { user: WorkspacePayload['user'] }
      setWorkspace((current) => current ? { ...current, user: payload.user } : current)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSavingProfile(false)
    }
  }

  const deleteStoredData = async () => {
    const confirmed = window.confirm('Delete all chats, folders, activities, and stored profile data for this account?')
    if (!confirmed) return

    setIsDeletingData(true)
    setErrorMessage('')

    try {
      const res = await authorizedFetch('/api/settings/data', { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      setChatCache({})
      setSelectedChatId(null)
      setActiveFilter('all')
      await loadWorkspace(false)
      setMainView('settings')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeletingData(false)
    }
  }

  return (
    <div className="h-dvh overflow-hidden bg-background p-4 sm:p-6">
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">poorplexity</h1>
              <p className="text-xs text-muted-foreground">Minimal chat workspace</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold">
                {userInitial}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => clerk.signOut({ redirectUrl: window.location.origin })}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="flex gap-2">
              <Button
                className="h-10 flex-1 justify-start gap-2"
                disabled={isCreatingChat}
                onClick={() => {
                  createNewChat().catch((error: Error) => setErrorMessage(error.message))
                }}
              >
                {isCreatingChat ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                New chat
              </Button>
              <Button
                variant={mainView === 'settings' ? 'secondary' : 'outline'}
                size="icon-sm"
                onClick={() => setMainView('settings')}
                aria-label="Open settings"
              >
                <Settings className="size-4" />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FolderPlus className="size-3.5" />
              Folders
            </div>
            <div className="flex gap-2">
              <Input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Create folder"
                className="h-9"
              />
              <Button
                variant="outline"
                size="icon-sm"
                disabled={isCreatingFolder || !newFolderName.trim()}
                onClick={createFolder}
              >
                {isCreatingFolder ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              </Button>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter('all')}
              >
                All
              </Button>
              <Button
                variant={activeFilter === 'unfiled' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter('unfiled')}
              >
                Unfiled
              </Button>
            </div>
          </div>

          <Separator />

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-4">
              {folders.map((folder) => (
                <div key={folder.id} className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant={activeFilter === folder.id ? 'secondary' : 'ghost'}
                      className="h-8 flex-1 justify-start gap-2 px-2"
                      onClick={() => setActiveFilter(folder.id)}
                    >
                      <Folder className="size-3.5" />
                      <span className="truncate">{folder.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {groupedChats.get(folder.id)?.length ?? 0}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeFolder(folder.id)}
                      aria-label={`Delete ${folder.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="space-y-1 pt-2">
                {visibleChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => {
                      setSelectedChatId(chat.id)
                      setMainView('chat')
                    }}
                    className={joinClasses(
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                      selectedChatId === chat.id
                        ? 'border-foreground/15 bg-muted'
                        : 'border-transparent hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{chat.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {chat.lastMessagePreview || 'No messages yet.'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {visibleChats.length === 0 && (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    Nothing here yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              {selectedChat ? (
                editingTitle ? (
                  <div className="flex gap-2">
                    <Input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      className="h-9 w-[280px]"
                    />
                    <Button size="icon-sm" onClick={saveChatTitle}>
                      <Check className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="truncate text-xl font-semibold tracking-tight">{selectedChat.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{selectedChat.messageCount} messages</span>
                      <span>•</span>
                      <span>Updated {timeLabel(selectedChat.updatedAt)}</span>
                      {currentFolderId && (
                        <>
                          <span>•</span>
                          <Badge variant="outline">
                            {folders.find((folder) => folder.id === currentFolderId)?.name ?? 'Folder'}
                          </Badge>
                        </>
                      )}
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

            {selectedChat && !editingTitle && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setDraftTitle(selectedChat.title)
                    setEditingTitle(true)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeChat(selectedChat.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {errorMessage && (
            <div className="px-5 pt-4">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Something broke</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            </div>
          )}

          {mainView === 'settings' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="mx-auto max-w-3xl">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Edit the profile data this app stores and remove your local app data when needed.
                  </p>
                </div>

                <div className="grid gap-6">
                  <Card className="border-border shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Profile</CardTitle>
                      <CardDescription>
                        This updates the profile data stored in this app. Clerk account auth remains separate.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                      <div className="flex items-center gap-4">
                        {profileForm.imageUrl ? (
                          <img
                            src={profileForm.imageUrl}
                            alt=""
                            className="size-16 rounded-lg border border-border object-cover"
                            onError={(event) => {
                              (event.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="flex size-16 items-center justify-center rounded-lg border border-border bg-muted text-lg font-semibold">
                            {userInitial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{workspace?.user.email ?? 'No email'}</div>
                          <div className="text-xs text-muted-foreground">
                            Signed in through Clerk
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Display name</label>
                        <Input
                          value={profileForm.displayName}
                          onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                          placeholder="Display name"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Profile image URL</label>
                        <Input
                          value={profileForm.imageUrl}
                          onChange={(event) => setProfileForm((current) => ({ ...current, imageUrl: event.target.value }))}
                          placeholder="https://..."
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Bio</label>
                        <Textarea
                          value={profileForm.bio}
                          onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                          placeholder="A short bio for your local profile"
                          className="min-h-28"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          className="gap-2"
                          disabled={isSavingProfile}
                          onClick={() => saveProfile().catch((error: Error) => setErrorMessage(error.message))}
                        >
                          {isSavingProfile ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Save changes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-destructive/30 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Delete stored app data</CardTitle>
                      <CardDescription>
                        Removes chats, folders, activity logs, and locally stored profile fields from this app.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <p className="text-sm text-muted-foreground">
                        This does not delete your Clerk account. It only wipes data stored by poorplexity.
                      </p>
                      <div className="flex justify-end">
                        <Button
                          variant="destructive"
                          className="gap-2"
                          disabled={isDeletingData}
                          onClick={() => deleteStoredData().catch((error: Error) => setErrorMessage(error.message))}
                        >
                          {isDeletingData ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          Delete my stored data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : selectedChat ? (
            <>
              <div className="flex flex-wrap gap-2 px-5 py-3">
                <Button
                  variant={currentFolderId === null ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => moveChatToFolder(null)}
                >
                  Unfiled
                </Button>
                {folders.map((folder) => (
                  <Button
                    key={folder.id}
                    variant={currentFolderId === folder.id ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => moveChatToFolder(folder.id)}
                  >
                    {folder.name}
                  </Button>
                ))}
              </div>

              <Separator />

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="mx-auto flex max-w-4xl flex-col gap-6">
                  {selectedChat.messages.map((message) => (
                    <section
                      key={message.id}
                      className={joinClasses(
                        'max-w-3xl rounded-lg border px-4 py-4',
                        message.role === 'user'
                          ? 'ml-auto border-transparent bg-muted'
                          : 'border-border',
                      )}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <Badge variant={message.role === 'user' ? 'secondary' : 'outline'}>
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{timeLabel(message.createdAt)}</span>
                      </div>

                      {message.role === 'assistant' ? (
                        <div className="prose-answer">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content || (isSending && selectedChat.messages.at(-1)?.id === message.id ? 'Thinking...' : '')}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                      )}

                      {message.sources?.length ? <MessageSources sources={message.sources} /> : null}

                      {message.followUps?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {message.followUps.map((item) => (
                            <Button
                              key={item}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setComposer(item)
                                sendMessage(item)
                              }}
                            >
                              {item}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <Separator />

              <div className="px-5 py-4">
                <div className="mx-auto max-w-4xl">
                  <Textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        sendMessage().catch((error: Error) => setErrorMessage(error.message))
                      }
                    }}
                    placeholder="Ask a follow-up. Shift+Enter for a new line."
                    className="min-h-28"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Uses recent chat context plus fresh search results.
                    </p>
                    <Button
                      className="h-9 gap-2"
                      disabled={isSending || !composer.trim()}
                      onClick={() => sendMessage().catch((error: Error) => setErrorMessage(error.message))}
                    >
                      {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-muted">
                  <MessageSquare className="size-5" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">Start something useful</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Create a chat, keep related threads in folders, and stop losing context every five minutes.
                </p>
                <div className="mt-6">
                  <Button
                    className="gap-2"
                    onClick={() => {
                      createNewChat().catch((error: Error) => setErrorMessage(error.message))
                    }}
                  >
                    <Plus className="size-4" />
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

  if (!isLoaded) return <WorkspaceSkeleton />
  if (!userId) return <AuthGate />

  return (
    <>
      <ClerkLoading>
        <WorkspaceSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <Workspace />
      </ClerkLoaded>
    </>
  )
}
