import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PanelLeft, Plus, Send } from 'lucide-react'
import { AuthOverlay } from '@/components/auth/auth-overlay'
import { ThemeToggle } from '@/components/common/theme-toggle'
import { AnimatePresence, fadeUp, motion, subtleList } from '@/components/static-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { joinClasses } from '@/lib/format'
import type { ThemeMode } from '@/types/api'

export function PublicWorkspace({
  theme,
  onToggleTheme,
}: {
  theme: ThemeMode
  onToggleTheme: () => void
}) {
  const [composer, setComposer] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [examples] = useState([
    'Compare the latest M4 MacBook Air with comparable Windows ultrabooks.',
    'Explain bun vs node for production APIs with tradeoffs.',
    'Summarize the strongest arguments for and against nuclear power.',
  ])

  const openAuth = () => {
    window.localStorage.setItem('poorplexity-pending-draft', composer.trim())
    setShowAuth(true)
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background p-4 sm:p-6 lg:h-dvh lg:overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <div>
          <div className="text-base font-semibold tracking-tight">poorplexity</div>
          <div className="text-[11px] text-muted-foreground">Public workspace preview</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Button variant="outline" size="icon-sm" title="Open navigation" onClick={() => setShowSidebar(true)}>
            <PanelLeft className="size-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showSidebar ? (
          <motion.button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 z-30 bg-background/60 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="grid gap-3 lg:gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          className={joinClasses(
            'fixed inset-y-4 left-4 z-40 flex w-[min(88vw,340px)] min-h-0 flex-col rounded-md border border-border bg-card transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0',
            showSidebar ? 'translate-x-0' : '-translate-x-[120%]',
          )}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">poorplexity</h1>
              <p className="text-xs text-muted-foreground">Public workspace preview</p>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
          <div className="space-y-3 p-4">
            <Button className="h-10 justify-start" variant="outline" title="Create a chat after signing in">
              <Plus className="mr-2 size-4" />
              New chat
            </Button>
            <div className="rounded-md border border-border bg-background/60 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Try these</div>
              <div className="space-y-2">
                {examples.map((item) => (
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.995 }}
                    key={item}
                    onClick={() => {
                      setComposer(item)
                      setShowSidebar(false)
                    }}
                    className="premium-surface w-full border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    {item}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col rounded-md border border-border bg-card">
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Ask first. Sign in when it matters.</h2>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                  You can explore the workspace before login. Sending a message opens the minimal auth prompt.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button className="h-10 sm:min-w-28" variant="outline" onClick={openAuth}>
                  Sign in
                </Button>
                <Button className="h-10 sm:min-w-36" onClick={openAuth}>
                  Continue with Google
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-visible px-4 py-3 sm:px-5 sm:py-5 lg:min-h-0 lg:overflow-y-auto">
            <motion.div variants={subtleList} initial={false} animate="animate" className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-5">
              <motion.div {...fadeUp}>
                <Card className="premium-surface shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">What the product does</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span>Continuous chat with context controls</span>
                      <Badge variant="outline">Live</Badge>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span>Branching, regenerate, export, archive, restore</span>
                      <Badge variant="outline">Live</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Public profile with analytics by username</span>
                      <Badge variant="outline">Live</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.section {...fadeUp} className="premium-surface rounded-md border border-border bg-background/70 px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Assistant</Badge>
                  <span className="text-xs text-muted-foreground">Preview</span>
                </div>
                <div className="prose-answer">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {'- Answers can be short or detailed.\n- Web search can be toggled per message.\n- Sources and injected context are visible instead of being hidden behind product theater.'}
                  </ReactMarkdown>
                </div>
              </motion.section>
            </motion.div>
          </div>

          <div className="glass mobile-composer sticky bottom-0 z-20 mt-auto border-t border-border px-4 py-3 sm:px-5 sm:py-4">
            <div className="mx-auto max-w-4xl">
              <Textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (composer.trim()) openAuth()
                  }
                }}
                placeholder="Write your question. Send will ask you to sign in."
                className="min-h-18 max-h-32 sm:min-h-28"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground sm:text-xs">Your draft will be preserved through sign-in.</p>
                <Button className="h-11 w-full sm:w-auto" disabled={!composer.trim()} onClick={() => openAuth()}>
                  <Send className="mr-2 size-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AuthOverlay
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />
    </div>
  )
}
