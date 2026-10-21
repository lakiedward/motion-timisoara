import { Link, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'

import { getMyClub } from '@/api/club'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'

export function ClubApprovalGate() {
  const clubQuery = useQuery({ queryKey: ['my-club'], queryFn: getMyClub, retry: false })
  if (clubQuery.isPending) return <StatusView state="loading" title="Se încarcă clubul" />
  const club = clubQuery.data
  if (club && !club.approved_at) return <ClubPendingScreen clubName={club.name} />
  return <Outlet />
}

export function ClubPendingScreen({ clubName }: { clubName: string }) {
  return (
    <section
      aria-labelledby="club-pending-title"
      className="bg-card grid justify-items-center gap-2 rounded-xl border px-6 py-12 text-center"
    >
      <span className="bg-primary/10 text-primary mb-2 grid size-12 place-items-center rounded-full">
        <Clock aria-hidden="true" className="size-6" />
      </span>
      <h1 id="club-pending-title" className="font-display text-foreground text-2xl font-bold">
        Clubul tău așteaptă aprobarea
      </h1>
      <p className="text-muted-foreground max-w-100 text-sm">
        Un administrator Motion verifică datele clubului {clubName}. După aprobare se deschide
        panoul, iar clubul apare pe site.
      </p>
      <Button asChild variant="outline" className="h-touch-target min-h-touch-target mt-3">
        <Link to="/club/profile">Completează profilul clubului</Link>
      </Button>
    </section>
  )
}
