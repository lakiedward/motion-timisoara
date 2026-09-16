import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card } from '@/components/ui/card'
import type { PortalNavItem } from '@/layout/navigation'

export function NativeLinkGroup({ title, items }: { title: string; items: PortalNavItem[] }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-muted-foreground text-sm font-semibold">{title}</h2>
      <Card className="gap-0 overflow-hidden py-0">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-primary flex min-h-14 items-center gap-3 border-b px-4 py-3 text-sm font-medium last:border-b-0 focus-visible:outline focus-visible:-outline-offset-2"
          >
            <item.icon aria-hidden="true" className="text-primary size-5 shrink-0" />
            <span className="min-w-0 flex-1">{item.label}</span>
            <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          </Link>
        ))}
      </Card>
    </section>
  )
}
