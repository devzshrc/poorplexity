import type { UsageActivity } from '@/types/api'

export function formatActivityTypeLabel(type: string) {
  return type
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function summarizeActivity(item: UsageActivity) {
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

export function activityAccentClass(type: string) {
  if (type.startsWith('message.user')) return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/12 dark:text-blue-200'
  if (type.startsWith('message.assistant')) return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/12 dark:text-violet-200'
  if (type.startsWith('chat.')) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/12 dark:text-emerald-200'
  if (type.startsWith('folder.')) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/12 dark:text-amber-200'
  if (type.startsWith('billing.')) return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/12 dark:text-cyan-200'
  return 'bg-muted text-foreground border-border'
}
