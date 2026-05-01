import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { readApiError } from '@/api/client'
import { ThemeToggle } from '@/components/common/theme-toggle'
import { WorkspaceSkeleton } from '@/components/common/workspace-skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { API_BASE_URL } from '@/lib/config'
import type { PublicProfilePayload, ThemeMode } from '@/types/api'

export function PublicProfilePage({
  username,
  theme,
  onBack,
  onToggleTheme,
}: {
  username: string
  theme: ThemeMode
  onBack: () => void
  onToggleTheme: () => void
}) {
  const [profile, setProfile] = useState<PublicProfilePayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/api/public-profile/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res))
        return await res.json() as PublicProfilePayload
      })
      .then((payload) => {
        setProfile(payload)
        setError('')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [username])

  return (
    <div className="min-h-screen bg-background px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon-sm" onClick={onBack} title="Back to workspace">
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="text-sm font-medium">Public profile</div>
              <div className="text-xs text-muted-foreground">@{username}</div>
            </div>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>

        {loading ? (
          <WorkspaceSkeleton />
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Profile unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : profile ? (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="shadow-none">
              <CardHeader>
                <div className="flex items-center gap-4">
                  {profile.profile.imageUrl ? (
                    <img src={profile.profile.imageUrl} alt="" className="size-16 rounded-md object-cover" />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-md bg-muted text-lg font-semibold">
                      {profile.profile.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <CardTitle className="truncate">{profile.profile.displayName}</CardTitle>
                    <CardDescription>@{profile.profile.publicUsername}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {profile.profile.bio || 'No bio set yet.'}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Total chats', profile.stats.totalChats],
                  ['Total messages', profile.stats.totalMessages],
                  ['Active days', profile.stats.activeDays],
                  ['Pinned chats', profile.stats.pinnedChats],
                  ['Archived chats', profile.stats.archivedChats],
                  ['Avg messages/chat', profile.stats.averageMessagesPerChat],
                  ['Avg user msg length', profile.stats.averageUserMessageLength],
                  ['Folders', profile.stats.folders],
                  ['Sent today', profile.stats.sentToday],
                ].map(([label, value]) => (
                  <Card key={String(label)} className="shadow-none">
                    <CardHeader className="pb-2">
                      <CardDescription>{label}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Analytics snapshot</CardTitle>
                  <CardDescription>Platform-visible summary stats for this user’s workspace activity.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>User vs assistant messages</span>
                    <span>{profile.stats.userMessages} / {profile.stats.assistantMessages}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span>Organization density</span>
                    <span>{profile.stats.folders} folders</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Archival behavior</span>
                    <span>{profile.stats.archivedChats} archived</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
