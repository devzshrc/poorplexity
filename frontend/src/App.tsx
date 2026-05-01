import { useEffect, useState } from 'react'
import { ClerkLoaded, ClerkLoading, useAuth } from '@clerk/react'

import { WorkspaceSkeleton } from '@/components/common/workspace-skeleton'
import { PublicProfilePage } from '@/features/profile'
import { PublicWorkspace, Workspace } from '@/features/workspace'
import { parseRoute } from '@/lib/routing'
import type { RouteState, ThemeMode } from '@/types/api'

const getSavedTheme = (): ThemeMode => (window.localStorage.getItem('poorplexity-theme') as ThemeMode | null) ?? 'dark'

export default function App() {
  const { isLoaded, userId } = useAuth()
  const [theme, setTheme] = useState<ThemeMode>(() => getSavedTheme())
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    const onPopState = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    window.localStorage.setItem('poorplexity-theme', next)
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
