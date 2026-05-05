import { useEffect, useState } from 'react'
import { useClerk } from '@clerk/react'
import { AlertCircle, Loader2, LogIn, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatePresence, fadeUp, motion } from '@/components/static-motion'

export type AuthOverlayProps = {
  isOpen: boolean
  onClose: () => void
}

export function AuthOverlay({
  isOpen,
  onClose,
}: AuthOverlayProps) {
  const clerk = useClerk()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const redirectUrl = typeof window === 'undefined' ? '/' : window.location.href

  useEffect(() => {
    if (!isOpen) {
      setAuthError('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  const continueWithGoogle = async () => {
    setIsSubmitting(true)
    setAuthError('')
    try {
      await (clerk.client.signIn as unknown as {
        authenticateWithRedirect: (params: {
          strategy: 'oauth_google'
          redirectUrl: string
          redirectUrlComplete: string
        }) => Promise<unknown>
      }).authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl,
        redirectUrlComplete: redirectUrl,
      })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          {...fadeUp}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
        >
          <motion.div {...fadeUp} className="w-full max-w-sm">
            <Card className="surface-raised w-full shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Continue with Google</CardTitle>
                    <CardDescription className="mt-1">
                      Your draft will come with you. Sign in only when you want to save and keep working.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon-sm" title="Close sign-in" onClick={onClose}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="surface-subtle rounded-md px-4 py-3 text-sm text-muted-foreground">
                  Google is the only sign-in method for now. After auth, you return to this workspace with the draft intact.
                </div>

                <Button className="h-11 w-full justify-center" disabled={isSubmitting} onClick={() => void continueWithGoogle()}>
                  {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
                  Continue with Google
                </Button>

                {authError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{authError}</AlertDescription>
                  </Alert>
                ) : null}

                <p className="text-center text-xs text-muted-foreground">
                  Clerk handles the secure Google session; poorplexity keeps the workspace state.
                </p>

                <Button variant="ghost" className="w-full justify-center" onClick={onClose}>
                  Keep previewing
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
