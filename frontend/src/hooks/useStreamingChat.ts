import { consumeStream } from '@/lib/sse'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatDetail, Source, WorkspacePayload } from '@/types/api'

export type StreamingChatState = {
  setChatCache: Dispatch<SetStateAction<Record<string, ChatDetail>>>
  setWorkspace: Dispatch<SetStateAction<WorkspacePayload | null>>
  setErrorMessage: Dispatch<SetStateAction<string>>
}

export function useStreamingChat({
  setChatCache,
  setWorkspace,
  setErrorMessage,
}: StreamingChatState) {
  return async function attachStreamToAssistant(res: Response, chatId: string, signal: AbortSignal) {
    await consumeStream(res, {
      onSources: (sources: Source[]) => {
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
}
