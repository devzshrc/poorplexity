import { useState } from 'react'
import { ArrowRight, ExternalLink, GitBranch, PanelLeft, Search, Send, Sparkles } from 'lucide-react'
import { AuthOverlay } from '@/components/auth/auth-overlay'
import { ThemeToggle } from '@/components/common/theme-toggle'
import { AnimatePresence, fadeUp, motion, subtleList } from '@/components/static-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    'Compare M4 MacBook Air against premium Windows ultrabooks for a founder.',
    'Find the strongest arguments for and against nuclear power.',
    'Build a buying brief for an AI coding laptop under Rs 1.5L.',
  ])
  const proofPoints = [
    { label: 'Sources stay attached', value: '3 cited' },
    { label: 'Threads can branch', value: '1 click' },
    { label: 'Draft survives auth', value: 'Saved' },
  ]

  const openAuth = () => {
    window.localStorage.setItem('poorplexity-pending-draft', composer.trim())
    setShowAuth(true)
  }

  const useExample = (item: string) => {
    setComposer(item)
    setShowSidebar(false)
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background p-4 sm:p-6 lg:h-dvh lg:overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <div>
          <div className="text-base font-semibold tracking-tight">poorplexity</div>
          <div className="text-[11px] text-muted-foreground">Research workspace preview</div>
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
            'surface-panel fixed inset-y-4 left-4 z-40 flex w-[min(88vw,340px)] min-h-0 flex-col overflow-hidden rounded-md transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0',
            showSidebar ? 'translate-x-0' : '-translate-x-[120%]',
          )}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">poorplexity</h1>
              <p className="text-xs text-muted-foreground">Source-backed research, kept tidy.</p>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
          <div className="space-y-3 p-4">
            <Button className="h-10 justify-start" title="Continue with Google" onClick={openAuth}>
              <Sparkles className="mr-2 size-4" />
              Save a workspace
            </Button>
            <div className="surface-subtle rounded-md p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Start with a real brief</div>
              <div className="space-y-2">
                {examples.map((item) => (
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.995 }}
                    key={item}
                    onClick={() => useExample(item)}
                    className="surface-row w-full px-3 py-2 text-left text-xs"
                  >
                    {item}
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 pt-1">
              {proofPoints.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 px-1 text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="surface-panel flex min-h-0 flex-col overflow-hidden rounded-md">
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Ask first. Keep the research when it matters.</h2>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                  Try a brief, inspect the evidence, then sign in only when you want to save the thread.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button className="h-10 sm:min-w-32" variant="outline" onClick={() => useExample(examples[0])}>
                  Try example
                </Button>
                <Button className="h-10 sm:min-w-40" onClick={openAuth}>
                  Continue with Google
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-visible px-4 py-3 sm:px-5 sm:py-5 lg:min-h-0 lg:overflow-y-auto">
            <motion.div variants={subtleList} initial={false} animate="animate" className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-5">
              <motion.section {...fadeUp} className="surface-raised rounded-md px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Research preview</Badge>
                      <Badge variant="outline">3 sources</Badge>
                      <Badge variant="outline">Branchable</Badge>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight sm:text-lg">
                      M4 MacBook Air vs premium Windows ultrabooks
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      A founder who values battery life, quiet operation, and resale value should start with the M4 Air. Pick Windows only when ports, OLED, or specific x86 tools matter more than endurance.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 justify-center" onClick={() => useExample(examples[0])}>
                    Use this brief
                    <ArrowRight className="ml-2 size-3.5" />
                  </Button>
                </div>

                <div className="grid gap-3 py-4 sm:grid-cols-3">
                  {[
                    ['Decision', 'M4 Air for most buyers'],
                    ['Tradeoff', 'Windows wins on ports and OLED'],
                    ['Risk', 'Check x86-only app dependencies'],
                  ].map(([label, value]) => (
                    <div key={label} className="surface-subtle rounded-md px-3 py-3">
                      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
                      <div className="mt-1 text-sm font-medium">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-[1fr_0.85fr]">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Why the answer is useful</div>
                    <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                      <li className="flex gap-2"><Search className="mt-1 size-3.5 shrink-0" /> It separates buyer priorities instead of declaring a generic winner.</li>
                      <li className="flex gap-2"><GitBranch className="mt-1 size-3.5 shrink-0" /> You can branch the thread into budget, developer, or travel scenarios.</li>
                      <li className="flex gap-2"><ExternalLink className="mt-1 size-3.5 shrink-0" /> Sources stay beside the answer so claims can be checked later.</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Attached evidence</div>
                    {['Apple battery and performance notes', 'Notebookcheck display and thermals', 'OEM pricing and configuration pages'].map((source, index) => (
                      <div key={source} className="surface-row flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold">{index + 1}</span>
                        <span className="min-w-0 truncate">{source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            </motion.div>
          </div>

          <div className="surface-composer mobile-composer sticky bottom-0 z-20 mt-auto px-4 py-3 sm:px-5 sm:py-4">
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
                placeholder="Ask for a buying brief, comparison, source-backed summary, or plan."
                className="min-h-18 max-h-32 sm:min-h-24"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground sm:text-xs">Your draft is preserved if you continue with Google.</p>
                <Button className="h-11 w-full sm:w-auto" disabled={!composer.trim()} onClick={() => openAuth()}>
                  <Send className="mr-2 size-4" />
                  Send and save
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
