import type { RouteState } from '@/types/api'

export function parseRoute(pathname: string): RouteState {
  const match = pathname.match(/^\/u\/([a-zA-Z0-9_]+)$/)
  return match ? { kind: 'profile', username: match[1] } : { kind: 'workspace' }
}
