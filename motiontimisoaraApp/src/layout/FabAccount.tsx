import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function FabAccount({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <Button
      asChild
      size={null}
      className="fixed right-5 bottom-5 z-30 size-12 rounded-full shadow-lg lg:hidden [&_svg:not([class*='size-'])]:size-5"
    >
      <Link to="/account" aria-label="Contul meu">
        <UserRound />
      </Link>
    </Button>
  )
}
