import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

import { getAllUsers, setUserEnabled, type AdminUser } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'highlight'> = {
  ADMIN: 'highlight',
  CLUB: 'default',
  COACH: 'success',
  PARENT: 'secondary',
}

const ADMIN_LOCK = 'Conturile de administrator nu pot fi dezactivate'

const DATE_FMT = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** Cauta si peste diacritice: „parinte" trebuie sa gaseasca „Audit Părinte". */
function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** „1 utilizator", „19 utilizatori", „20 de utilizatori" — regula romaneasca pentru „de". */
function numaraUtilizatori(n: number) {
  if (n === 1) return '1 utilizator'
  const rest = n % 100
  return `${n}${n > 0 && (rest === 0 || rest > 19) ? ' de' : ''} utilizatori`
}

type ToggleArgs = { id: string; name: string; enabled: boolean }

/**
 * Actiunea din rand. Are contur si in repaus: pana acum era transparenta si se
 * citea ca text obisnuit, desi e singura actiune din sectiune.
 * Pe randurile de ADMIN ramane vizibila dar inactiva, cu motivul la hover —
 * celula goala de dinainte arata ca un buton lipsa, nu ca o regula.
 */
function ToggleAction({
  user,
  pending,
  onToggle,
  className,
}: {
  user: AdminUser
  pending: boolean
  onToggle: (args: ToggleArgs) => void
  className?: string
}) {
  if (user.role === 'ADMIN') {
    return (
      // Butonul dezactivat are pointer-events: none, deci tooltipul sta pe span.
      <span title={ADMIN_LOCK}>
        <Button variant="outline" size="sm" disabled className={className}>
          Dezactivează
        </Button>
      </span>
    )
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() => onToggle({ id: user.id, name: user.name, enabled: !user.enabled })}
    >
      {user.enabled ? 'Dezactivează' : 'Activează'}
    </Button>
  )
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  // Badge, nu text colorat: acelasi limbaj cu badge-ul de ROL de alaturi si
  // acelasi tipar ca „Activ/Inactiv" de pe cursurile de club.
  return (
    <Badge variant={enabled ? 'success' : 'outline'}>{enabled ? 'Activ' : 'Dezactivat'}</Badge>
  )
}

const COLOANE = ['Nume', 'Email', 'Rol', 'Status'] as const

/**
 * Sceletul reia exact structura tabelului, cu acelasi antet, ca primul rand sa
 * apara pe aceeasi pozitie ca dupa incarcare. Blocul unic de 256px de dinainte
 * era de patru ori mai scund decat lista reala, deci pagina sarea vizibil.
 */
function LoadingState() {
  const randuri = [0, 1, 2, 3, 4, 5]
  return (
    <>
      {/* Tine locul numaratorului. Fara el, tabelul statea cu 32px mai sus in
          incarcare decat dupa, deci primul rand tot sarea. */}
      <Skeleton className="mb-3 h-5 w-28" />
      <div className="bg-card shadow-card hidden overflow-hidden rounded-3xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
            <tr>
              {COLOANE.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">
                  {c}
                </th>
              ))}
              <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">
                Înregistrat
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Acțiuni</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {randuri.map((i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-32" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-52" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-16" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-14" />
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <Skeleton className="h-5 w-24" />
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
          <Skeleton key={i} className="h-36 rounded-3xl" />
        ))}
      </div>
    </>
  )
}

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')

  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['admin-users'], queryFn: getAllUsers, retry: false })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: ToggleArgs) => setUserEnabled(id, enabled),
    onSuccess: (_res, { name, enabled }) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`Contul lui ${name} a fost ${enabled ? 'activat' : 'dezactivat'}.`)
    },
    onError: () => toast.error('Nu am putut actualiza utilizatorul.'),
  })

  const filtered = useMemo(() => {
    const needle = fold(q.trim())
    if (!needle) return users
    return users.filter((u) => fold(`${u.name} ${u.email}`).includes(needle))
  }, [users, q])

  const onToggle = (args: ToggleArgs) => toggle.mutate(args)

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-foreground text-2xl font-bold">Utilizatori</h1>
        <div className="relative w-full md:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după nume sau email"
            aria-label="Caută utilizatori după nume sau email"
            className="h-11 min-h-11 pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError && users.length === 0 ? (
        // Garda pe lungime: un refetch picat trecator nu are voie sa stearga de pe
        // ecran utilizatorii deja incarcati. Fara ramura asta, o incarcare esuata
        // arata identic cu „platforma nu are niciun utilizator".
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca utilizatorii.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : users.length === 0 ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun utilizator înregistrat.
        </div>
      ) : (
        <>
          <p role="status" className="text-muted-foreground mb-3 text-sm">
            {q.trim()
              ? `${filtered.length} din ${numaraUtilizatori(users.length)}`
              : numaraUtilizatori(users.length)}
          </p>

          {filtered.length === 0 ? (
            <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
              Niciun utilizator nu se potrivește cu căutarea.{' '}
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
              {/* De la 768px in sus tabel — acolo incape masurat; sub 768px carduri,
                  fiindca tabelul avea 689px intr-un container de 310px si coloanele
                  Rol si Status plus toate butoanele ramaneau in afara ecranului. */}
              <div className="bg-card shadow-card hidden overflow-hidden rounded-3xl border md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
                    <tr>
                      {COLOANE.map((c) => (
                        <th key={c} scope="col" className="px-4 py-3 font-semibold">
                          {c}
                        </th>
                      ))}
                      <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">
                        Înregistrat
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">Acțiuni</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      // Tabelul are 1102px pe desktop: fara evidentierea randului,
                      // ochiul pierde linia intre nume si butonul din capat.
                      <tr key={u.id} className="hover:bg-accent border-t transition-colors">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="text-muted-foreground px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={ROLE_VARIANT[u.role] ?? 'secondary'}>{u.role}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge enabled={u.enabled} />
                        </td>
                        {/* Explica ordinea listei si deosebeste conturile omonime.
                            Ascunsa sub 1024px, unde tabelul e deja stramt. */}
                        <td className="text-muted-foreground hidden px-4 py-3 whitespace-nowrap lg:table-cell">
                          {DATE_FMT.format(new Date(u.created_at))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ToggleAction
                            user={u}
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
                {filtered.map((u) => (
                  <li key={u.id} className="bg-card shadow-card rounded-3xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium">{u.name}</span>
                      <Badge variant={ROLE_VARIANT[u.role] ?? 'secondary'}>{u.role}</Badge>
                    </div>
                    {/* Emailul se rupe pe doua randuri: e singurul lucru care
                        deosebeste doua conturi cu acelasi nume. */}
                    <p className="text-muted-foreground mt-1 text-sm break-all">{u.email}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <StatusBadge enabled={u.enabled} />
                      <ToggleAction
                        user={u}
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
