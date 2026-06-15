import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, getClubLocations, setClubLocationActive } from '@/api/club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const TYPE_LABEL: Record<string, string> = { POOL: 'Bazin', TRACK: 'Pistă', GYM: 'Sală', OTHER: 'Alt tip' }

export default function ClubLocationsPage() {
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['club-locations', clubId],
    queryFn: () => getClubLocations(clubId),
    enabled: !!clubId,
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setClubLocationActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-locations', clubId] }),
    onError: () => toast.error('Nu am putut actualiza locația.'),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Locațiile clubului</h1>
        <Button asChild>
          <Link to="/club/locations/new">
            <Plus /> Locație nouă
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : locations.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.map((l) => (
            <div key={l.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{l.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{TYPE_LABEL[l.type] ?? l.type}</Badge>
                    <Badge variant={l.is_active ? 'success' : 'outline'}>
                      {l.is_active ? 'Activă' : 'Inactivă'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground mt-2 flex items-center gap-1 text-sm">
                <MapPin className="size-4" /> {l.address ? `${l.address}, ` : ''}
                {l.city ?? '—'}
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/club/locations/${l.id}/edit`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: l.id, active: !l.is_active })}
                >
                  {l.is_active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Nicio locație încă.{' '}
          <Link to="/club/locations/new" className="text-primary font-semibold">
            Adaugă prima locație
          </Link>
        </div>
      )}
    </div>
  )
}
