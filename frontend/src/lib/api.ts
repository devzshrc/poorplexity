import { API_BASE_URL } from '@/lib/config'
import type { ApiErrorPayload } from '@/types/api'

export async function readApiError(res: Response): Promise<string> {
  const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as ApiErrorPayload
  return payload.error ?? `HTTP ${res.status}`
}

export function createAuthorizedApi(getToken: () => Promise<string | null>) {
  return async function authorizedFetch(path: string, init?: RequestInit) {
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
}

export async function readJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await readApiError(res))
  return await res.json() as T
}

export async function assertOk(res: Response): Promise<void> {
  if (!res.ok && res.status !== 204) throw new Error(await readApiError(res))
}
