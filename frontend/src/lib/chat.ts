import type { ChatSettings, PreferenceRecord } from '@/types/api'

export type AnswerStylePreset = 'concise' | 'structured' | 'deep-dive'
export type SourceLayout = 'answer-first' | 'sources-first'
export type SlashCommandId = 'summarize' | 'compare' | 'plan' | 'research' | 'rewrite'

export const MODEL_OPTIONS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
] as const

type StyleSettings =
  | Pick<PreferenceRecord, 'answerMode' | 'responseLength' | 'outputFormat'>
  | Pick<ChatSettings, 'answerMode' | 'responseLength' | 'outputFormat'>

export function inferAnswerStyle(settings: StyleSettings): AnswerStylePreset {
  if (settings.answerMode === 'deep' || settings.responseLength === 'long') return 'deep-dive'
  if (settings.answerMode === 'balanced' || settings.responseLength === 'medium') return 'structured'
  return 'concise'
}

export function applyAnswerStylePreset<T extends StyleSettings>(
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

export function memoryItemsFromNotes(notes: string) {
  return notes
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
}

export function notesFromMemoryItems(items: string[]) {
  return items.map((item) => `- ${item.trim()}`).join('\n')
}

export function extractSlashCommand(text: string): { command: SlashCommandId | null; content: string } {
  const match = text.trimStart().match(/^\/(summarize|compare|plan|research|rewrite)\b/i)
  if (!match) return { command: null, content: text }
  const command = match[1].toLowerCase() as SlashCommandId
  return {
    command,
    content: text.trimStart().slice(match[0].length).trim(),
  }
}

export function commandPrompt(command: SlashCommandId, content: string) {
  if (command === 'summarize') return `Summarize this clearly with short sections, key points, and a bottom-line takeaway.\n\n${content}`
  if (command === 'compare') return `Compare this clearly. Use a short answer first, then bullets for differences, tradeoffs, and best choice.\n\n${content}`
  if (command === 'plan') return `Create a practical step-by-step plan. Keep it concrete, ordered, and easy to execute.\n\n${content}`
  if (command === 'research') return `Research this thoroughly. Use strong structure with sections, evidence, and recommendations.\n\n${content}`
  return `Rewrite this for clarity and polish. Keep the meaning, remove fluff, and improve structure.\n\n${content}`
}
