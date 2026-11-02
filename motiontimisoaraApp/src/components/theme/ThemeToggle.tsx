import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useThemePreference } from '@/lib/theme/use-theme'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useThemePreference()
  const next = resolved === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? 'Treci la tema întunecată' : 'Treci la tema luminoasă'
  const Icon = resolved === 'dark' ? Sun : Moon

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setPreference(next)}
      className={className}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}
