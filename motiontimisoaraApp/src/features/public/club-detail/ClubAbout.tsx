import type { ClubListItem } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { descriptionParagraphs } from '@/lib/course-detail'

export function ClubAbout({ club }: { club: ClubListItem }) {
  const sports = (club.club_sports ?? []).flatMap((cs) => (cs.sport ? [cs.sport] : []))
  if (!club.description && sports.length === 0) return null

  return (
    <section className="bg-card h-fit rounded-xl border p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold">Despre club</h2>
      {club.description && (
        <div className="text-muted-foreground mt-3 space-y-3 leading-relaxed">
          {descriptionParagraphs(club.description).map((part, index) => (
            <p key={index}>{part}</p>
          ))}
        </div>
      )}
      {sports.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {sports.map((sport) => (
            <Badge key={sport.id}>{sport.name}</Badge>
          ))}
        </div>
      )}
    </section>
  )
}
