import type { AnnouncementRow } from '@/api/announcements/parent'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'
import { AnnouncementGridCard, AnnouncementListCard } from './AnnouncementCard'
import { groupByMonth, isNew } from './announcement-display'
import { useAnnouncementMedia } from './useAnnouncementMedia'

export type FeedLayout = 'months' | 'grid'

type Props = {
  items: AnnouncementRow[]
  userId: string
  previousSeenAt: string | null
  layout: FeedLayout
}

export function AnnouncementFeed({ items, userId, previousSeenAt, layout }: Props) {
  const media = useAnnouncementMedia(items, userId)
  const card = (item: AnnouncementRow) => {
    const props = {
      item,
      attachments: media.data?.[item.source][item.id] ?? [],
      fresh: isNew(item, previousSeenAt),
    }
    return (
      <li key={`${item.source}-${item.id}`} className="min-w-0">
        {layout === 'grid' ? (
          <AnnouncementGridCard {...props} />
        ) : (
          <AnnouncementListCard {...props} />
        )}
      </li>
    )
  }

  return (
    <div className="space-y-6">
      {layout === 'grid' ? (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Anunțuri">
          {items.map(card)}
        </ul>
      ) : (
        groupByMonth(items).map((group) => (
          <section key={group.key} aria-label={group.title}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{group.title}</h2>
              <span className="text-muted-foreground text-sm">
                {plural(group.items.length, 'anunț', 'anunțuri')}
              </span>
            </div>
            <ul className="space-y-3" aria-label={`Anunțuri ${group.title}`}>
              {group.items.map(card)}
            </ul>
          </section>
        ))
      )}
      {media.isPending && items.length > 0 && (
        <p className="text-muted-foreground text-sm" role="status">
          Se încarcă atașamentele…
        </p>
      )}
      {media.isError && (
        <div className="bg-card rounded-xl border p-4" role="alert">
          <p className="text-sm">Nu am putut încărca atașamentele acestor anunțuri.</p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => void media.refetch()}
            disabled={media.isFetching}
          >
            Reîncearcă atașamentele
          </Button>
        </div>
      )}
    </div>
  )
}
