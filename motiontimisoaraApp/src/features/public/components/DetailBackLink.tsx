import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function DetailBackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex h-touch-target items-center gap-1 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  )
}
