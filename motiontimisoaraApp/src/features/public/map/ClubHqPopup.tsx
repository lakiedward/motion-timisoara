import { Link } from 'react-router-dom'
import { Building2, ChevronRight } from 'lucide-react'
import type { ClubHeadquarters } from '@/api/public'

export default function ClubHqPopup({ club }: { club: ClubHeadquarters }) {
  const address = [club.address, club.city].filter(Boolean).join(', ')
  return (
    <>
      <div className="bg-foreground shrink-0 px-3.5 py-3">
        <div className="flex items-start gap-2.5 pr-11">
          <span className="bg-background/20 text-background mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-background text-xs font-bold uppercase tracking-wide">
              Sediu club
            </div>
            <div className="font-display text-background break-words text-base font-extrabold leading-tight">
              {club.name}
            </div>
            {address && (
              <div className="text-background mt-1 break-words text-xs leading-snug">{address}</div>
            )}
          </div>
        </div>
      </div>
      <div className="p-3">
        <Link
          to={`/cluburi/${club.id}`}
          className="group/item -mx-1.5 flex min-h-11 items-center gap-2.5 rounded-xl px-1.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex-1">Vezi pagina clubului</span>
          <ChevronRight className="text-muted-foreground group-hover/item:text-primary size-4 shrink-0" />
        </Link>
      </div>
    </>
  )
}
