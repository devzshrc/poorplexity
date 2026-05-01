import type { ChatSummary, SSEHandlers, Source } from '@/types/api'

export async function consumeStream(res: Response, handlers: SSEHandlers, signal: AbortSignal) {
  if (!res.body) throw new Error('Streaming response is unavailable')

  const reader = res.body.getReader()
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
