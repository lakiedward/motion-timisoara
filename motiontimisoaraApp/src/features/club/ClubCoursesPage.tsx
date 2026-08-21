import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, getClubCourses, setClubCourseActive } from '@/api/club'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClubCoursesPage() {
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: courses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['club-courses', clubId],
    queryFn: () => getClubCourses(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setClubCourseActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-courses', clubId] }),
    // Refuzul RLS (cod 42501) are o cauză pe care clubul o poate remedia singur:
    // cursul e predat de un antrenor care nu e în club. Mesajul generic o ascundea.
    onError: (e: unknown) =>
      toast.error(
        (e as { code?: string })?.code === '42501'
          ? 'Nu poți modifica acest curs: antrenorul lui nu face parte din club.'
          : 'Nu am putut actualiza cursul.'
      ),
  })

  return (
    <div>
      {/* Sub 640 px „Curs nou” coboară pe rândul lui: la 375 px rămâneau 6 px
          între titlu și buton. De la sm în sus revin pe același rând. */}
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Cursurile clubului</h1>
        <Button asChild>
          <Link to="/club/courses/new">
            <Plus /> Curs nou
          </Link>
        </Button>
      </div>

      {isLoading ? (
        // Inaltimile urmaresc cardul real, ca lista sa nu sara cand sosesc datele:
        // 210 px sub 1024 px, unde linia gri curge pe doua randuri, 190 px peste.
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-3xl lg:h-48" />
          ))}
        </div>
      ) : isError && !courses.length ? (
        // Fara ramura asta, o incarcare esuata afisa „Niciun curs inca”, deci un
        // club cu 40 de cursuri era invitat sa-si creeze primul. Garda pe lungime
        // e la fel de importanta: `onSuccess` la comutare invalideaza lista, iar un
        // refetch picat trecator nu are voie sa stearga de pe ecran cursurile deja
        // incarcate. Acelasi tipar ca pe /coach/attendance.
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca cursurile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : courses.length ? (
        // `sm:auto-rows-fr` egalizeaza randurile din grila, ca un titlu pe doua
        // randuri sa nu faca un card mai inalt decat vecinul lui. Pe telefon nu
        // se aplica: acolo cardurile sunt stivuite si au voie sa creasca.
        <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
          {courses.map((c) => (
            <div key={c.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{c.name}</h3>
                  {/* Doua cursuri pot avea acelasi nume; locatia e ce le deosebeste,
                      iar in linia gri de jos se pierdea intre antrenor si varsta. */}
                  <div className="text-muted-foreground text-sm">{c.location?.name ?? '—'}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.sport && <Badge>{c.sport.name}</Badge>}
                    <Badge variant={c.active ? 'success' : 'outline'}>
                      {c.active ? 'Activ' : 'Inactiv'}
                    </Badge>
                  </div>
                </div>
                <span className="font-display font-bold">{formatRon(c.price)}</span>
              </div>
              {/* Locatia a urcat langa titlu, unde deosebeste cursurile omonime;
                  aici ramane antrenorul, informatia care lipseste cel mai des la club. */}
              <div className="text-muted-foreground mt-2 text-sm">
                {c.coach?.name ?? '—'}
                {c.age_from != null && ` · ${c.age_from}–${c.age_to} ani`}
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/club/courses/${c.id}/edit`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                >
                  {c.active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun curs încă.{' '}
          <Link to="/club/courses/new" className="text-primary font-semibold">
            Creează primul curs
          </Link>
        </div>
      )}
    </div>
  )
}
