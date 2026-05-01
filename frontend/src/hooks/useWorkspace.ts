import { useMemo } from 'react'
import { createAuthorizedApi } from '@/api/client'

export function useWorkspaceApi(getToken: () => Promise<string | null>) {
  const authorizedFetch = useMemo(() => createAuthorizedApi(getToken), [getToken])
  return { authorizedFetch }
}
