import { Link } from 'react-router-dom'

import { childAge, type Child } from '@/api/account'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const linkCardClass = cn(
  'flex items-center gap-3 rounded-lg p-2 transition-colors',
  'hover:bg-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
)

export function DashboardChildrenList({ items }: { items: Child[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <div key={c.id} className="bg-card space-y-2 rounded-xl border p-3">
          <Link to={`/account/child/${c.id}`} className={linkCardClass}>
            <Avatar aria-hidden="true" className="size-10">
              <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold break-words">{c.name}</div>
              <div className="text-muted-foreground text-sm">{childAge(c.birth_date)} ani</div>
            </div>
          </Link>
          <Button asChild variant="outline" className="w-full">
            <Link
              to={`/account/attendance?copil=${encodeURIComponent(c.id)}`}
              aria-label={`Vezi prezența pentru ${c.name}`}
            >
              Vezi prezența
            </Link>
          </Button>
        </div>
      ))}
    </div>
  )
}
