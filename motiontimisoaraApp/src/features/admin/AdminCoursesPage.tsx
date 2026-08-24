import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

import { getAllCourses, setCourseActiveAdmin, type AdminCourse } from '@/api/admin'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const COLOANE = ['Curs', 'Sport', 'Antrenor', 'Preț', 'Status'] as const

/** Cauta si peste diacritice: „inot" trebuie sa gaseasca „Înot începători". */
function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** „1 curs", „7 cursuri", „20 de cursuri" — regula romaneasca pentru „de". */
function numaraCursuri(n: number) {
  if (n === 1) return '1 curs'
  const rest = n % 100
  return `${n}${n > 0 && (rest === 0 || rest > 19) ? ' de' : ''} cursuri`
}

/** Cursurile fara club sunt ale antrenorilor independenti, nu date lipsa. */
function apartenenta(course: AdminCourse) {
  return course.club?.name ?? 'Antrenor independent'
}

type ToggleArgs = { id: string; name: string; active: boolean }

function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'outline'}>{active ? 'Activ' : 'Inactiv'}</Badge>
}

/**
 * Actiunea din rand. Are contur si in repaus: pana acum era transparenta, cu
 * border-width 0, si se citea ca text obisnuit.
 */
function ToggleAction({
  course,
  pending,
  onToggle,
  className,
}: {
  course: AdminCourse
  pending: boolean
  onToggle: (args: ToggleArgs) => void
  className?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() => onToggle({ id: course.id, name: course.name, active: !course.active })}
    >
      {course.active ? 'Dezactivează' : 'Activează'}
    </Button>
  )
}

/**
 * Sceletul reia structura tabelului si tine locul numaratorului, ca titlul si
 * primul rand sa nu se mute cand sosesc datele. Blocul unic de 256px de dinainte
 * era mai scund decat tabelul real de 439px, deci pagina sarea vizibil.
 */
function LoadingState() {
  const randuri = [0, 1, 2, 3, 4]
  return (
    <>
      <Skeleton className="mb-3 h-5 w-24" />
      <div className="bg-card shadow-card hidden overflow-hidden rounded-3xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
            <tr>
              {COLOANE.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">
                  {c}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Acțiuni</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {randuri.map((i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-40" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-20" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-28" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="ml-auto h-5 w-20" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-14" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="ml-auto h-5 w-28" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {randuri.slice(0, 4).map((i) => (
          <Skeleton key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    </>
  )
}

export default function AdminCoursesPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')

  const {
    data: courses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['admin-courses'], queryFn: getAllCourses, retry: false })

  const toggle = useMutation({
    mutationFn: ({ id, active }: ToggleArgs) => setCourseActiveAdmin(id, active),
    onSuccess: (_res, { name, active }) => {
      qc.invalidateQueries({ queryKey: ['admin-courses'] })
      toast.success(`Cursul ${name} a fost ${active ? 'activat' : 'dezactivat'}.`)
    },
    onError: () => toast.error('Nu am putut actualiza cursul.'),
  })

  const filtered = useMemo(() => {
    const needle = fold(q.trim())
    if (!needle) return courses
    return courses.filter((c) => fold(`${c.name} ${c.coach?.name ?? ''}`).includes(needle))
  }, [courses, q])

  const onToggle = (args: ToggleArgs) => toggle.mutate(args)

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-foreground text-2xl font-bold">Cursuri</h1>
        <div className="relative w-full md:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după curs sau antrenor"
            aria-label="Caută cursuri după nume sau antrenor"
            className="h-11 min-h-11 pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError && courses.length === 0 ? (
        // Garda pe lungime: un refetch picat trecator nu are voie sa stearga de pe
        // ecran cursurile deja incarcate, si o incarcare esuata nu are voie sa arate
        // ca „platforma nu are niciun curs".
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca cursurile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed px-6 py-16 text-center">
          {/* Din admin nu exista nicio cale de creare, deci mesajul spune unde se face. */}
          Niciun curs înregistrat. Cursurile se creează din portalul clubului sau al
          antrenorului.
        </div>
      ) : (
        <>
          <p role="status" className="text-muted-foreground mb-3 text-sm">
            {q.trim()
              ? `${filtered.length} din ${numaraCursuri(courses.length)}`
              : numaraCursuri(courses.length)}
          </p>

          {filtered.length === 0 ? (
            <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
              Niciun curs nu se potrivește cu căutarea.{' '}
              <button
                type="button"
                onClick={() => setQ('')}
                className="text-primary inline-flex min-h-11 items-center font-semibold lg:min-h-0"
              >
                Șterge căutarea
              </button>
            </div>
          ) : (
            <>
              {/* De la 768px in sus tabel — acolo incape masurat (718px); sub 768px
                  fise, fiindca tabelul avea 600px intr-un container de 325px si
                  coloana Status plus toate butoanele ramaneau in afara ecranului. */}
              <div className="bg-card shadow-card hidden overflow-hidden rounded-3xl border md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
                    <tr>
                      {COLOANE.map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className={`px-4 py-3 font-semibold ${c === 'Preț' ? 'text-right' : ''}`}
                        >
                          {c}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">Acțiuni</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-accent border-t transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium">{c.name}</span>
                          {/* Locatia deosebeste cursurile omonime: doua cursuri pot
                              avea acelasi nume, sport si antrenor. */}
                          <span className="text-muted-foreground block text-xs">
                            {c.location?.name ?? '—'}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-4 py-3">{c.sport?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">{c.coach?.name ?? '—'}</span>
                          <span className="text-muted-foreground block text-xs">
                            {apartenenta(c)}
                          </span>
                        </td>
                        {/* Aliniat la dreapta, ca zecimalele sa cada una sub alta. */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {formatRon(c.price)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge active={c.active} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ToggleAction
                            course={c}
                            pending={toggle.isPending}
                            onToggle={onToggle}
                            className="h-11 min-h-11 lg:h-8 lg:min-h-8"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="grid list-none gap-3 md:hidden">
                {filtered.map((c) => (
                  <li key={c.id} className="bg-card shadow-card rounded-3xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground block text-sm">
                          {c.location?.name ?? '—'}
                        </span>
                      </div>
                      <StatusBadge active={c.active} />
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {c.sport?.name ?? '—'} · {c.coach?.name ?? '—'} · {apartenenta(c)}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="font-display font-bold">{formatRon(c.price)}</span>
                      <ToggleAction
                        course={c}
                        pending={toggle.isPending}
                        onToggle={onToggle}
                        className="h-11 min-h-11"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
