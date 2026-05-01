import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ThemeMode } from '@/types/api'

export function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="h-9 w-9"
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
