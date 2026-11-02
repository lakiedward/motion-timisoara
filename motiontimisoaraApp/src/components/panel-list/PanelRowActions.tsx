import { Link } from 'react-router-dom'
import { Pencil, Power } from 'lucide-react'

import { Button } from '@/components/ui/button'

const ACTION = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'

export function PanelEditAction({ to, name }: { to: string; name: string }) {
  return (
    <Button asChild variant="outline" className={ACTION}>
      <Link to={to} aria-label={`Editează ${name}`}>
        <Pencil aria-hidden="true" /> Editează
      </Link>
    </Button>
  )
}

export function PanelToggleAction({
  active,
  name,
  pending,
  onToggle,
}: {
  active: boolean
  name: string
  pending: boolean
  onToggle: () => void
}) {
  const label = active ? 'Dezactivează' : 'Activează'
  return (
    <Button
      type="button"
      variant="ghost"
      className={ACTION}
      disabled={pending}
      aria-label={`${label} ${name}`}
      onClick={onToggle}
    >
      <Power aria-hidden="true" />
      {label}
    </Button>
  )
}
