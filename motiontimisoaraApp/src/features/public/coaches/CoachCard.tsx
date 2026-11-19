import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { publicUrl, type CoachListItem } from '@/api/public'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('ro'))
    .join('')
}

export function CoachCard({ coach, badge }: { coach: CoachListItem; badge?: ReactNode }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const photo = publicUrl('coach-photos', coach.photo_storage_path)
  const name = coach.profile?.name ?? 'Antrenor'
  const sports = coach.coach_sports.flatMap(({ sport }) => (sport ? [sport] : []))
  return (
    <Link
      to={`/antrenori/${coach.user_id}`}
      className="bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card flex h-full min-w-0 items-center gap-4 rounded-xl border p-5 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none wrap-anywhere sm:flex-col sm:gap-0 sm:p-6 sm:text-center"
    >
      <Avatar className="size-16 sm:mb-4 sm:size-24">
        {photo && !photoFailed ? (
          <img
            src={photo}
            alt={name}
            onError={() => setPhotoFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <AvatarFallback aria-hidden="true" className="text-xl sm:text-3xl">
            {initials(name)}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="min-w-0">
        {badge ? <div className="mb-1.5 flex sm:justify-center">{badge}</div> : null}
        <h3 className="font-display text-foreground text-lg font-bold">{name}</h3>
        {sports.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5 sm:justify-center">
            {sports.map((sport) => (
              <Badge
                key={sport.id}
                variant="outline"
                className="max-w-full whitespace-normal wrap-anywhere"
              >
                {sport.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
