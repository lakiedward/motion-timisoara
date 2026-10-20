import { Link } from 'react-router-dom'

import { childAge, type Child } from '@/api/account'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const linkCardClass = cn(
  'bg-card flex items-center gap-3 rounded-xl border p-5 transition-colors',
  'hover:border-primary/40 hover:bg-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
)

export function DashboardChildrenList({ items }: { items: Child[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <Link key={c.id} to={`/account/child/${c.id}`} className={linkCardClass}>
          <Avatar aria-hidden="true" className="size-10">
            <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-semibold break-words">{c.name}</div>
            <div className="text-muted-foreground text-sm">{childAge(c.birth_date)} ani</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
