import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Megaphone, Users, XCircle } from 'lucide-react'

import { getClubCoaches, getMyClub } from '@/api/club'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClubDashboard() {
  const { data: club, isLoading } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const { data: coaches = [] } = useQuery({
    queryKey: ['club-coaches', club?.id],
    queryFn: () => getClubCoaches(club!.id),
    enabled: !!club,
  })

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />
  if (!club)
    return (
      <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
        Niciun club asociat contului.
      </div>
    )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">{club.name}</h1>
        <p className="text-muted-foreground mt-1">{club.city ?? 'Panoul clubului'}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/club/coaches" className="bg-card shadow-card hover:shadow-card-hover rounded-3xl p-6 transition-all hover:-translate-y-1">
          <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
            <Users className="size-5" />
          </span>
          <div className="font-display mt-4 text-3xl font-extrabold">{coaches.length}</div>
          <div className="text-muted-foreground text-sm">Antrenori</div>
        </Link>
        <Link to="/club/announcements" className="bg-card shadow-card hover:shadow-card-hover rounded-3xl p-6 transition-all hover:-translate-y-1">
          <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
            <Megaphone className="size-5" />
          </span>
          <div className="font-display mt-4 text-lg font-bold">Anunțuri</div>
          <div className="text-muted-foreground text-sm">Comunică cu părinții</div>
        </Link>
        <div className="bg-card shadow-card rounded-3xl p-6">
          <div className="text-sm font-semibold">Stripe</div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            {club.stripe_onboarding_complete ? (
              <>
                <CheckCircle2 className="text-success size-5" /> Configurat
              </>
            ) : (
              <>
                <XCircle className="text-muted-foreground size-5" /> Neconfigurat
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
