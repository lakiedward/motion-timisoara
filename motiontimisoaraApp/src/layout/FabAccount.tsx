import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Floating shortcut to the account area. Rendered only when authenticated.
 * Phase 3 wires `authenticated` to the real auth state; for now it stays hidden.
 */
export function FabAccount({ authenticated = false }: { authenticated?: boolean }) {
  if (!authenticated) return null
  return (
    <Button
      asChild
      size="icon"
      className="fixed right-5 bottom-5 z-30 size-12 rounded-full shadow-lg lg:hidden"
      aria-label="Contul meu"
    >
      <Link to="/account">
        <UserRound />
      </Link>
    </Button>
  )
}
