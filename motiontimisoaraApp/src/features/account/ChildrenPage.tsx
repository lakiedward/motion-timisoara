import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { childAge, deleteChild, getMyChildren } from '@/api/account'
import { formatLevel } from '@/lib/level'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function ChildrenPage() {
  const qc = useQueryClient()
  const { data: children = [], isLoading } = useQuery({ queryKey: ['children'], queryFn: getMyChildren })

  const del = useMutation({
    mutationFn: (id: string) => deleteChild(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['children'] })
      toast.success('Copilul a fost șters.')
    },
    onError: () => toast.error('Nu am putut șterge copilul.'),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Copiii mei</h1>
        <Button asChild>
          <Link to="/account/child/new">
            <Plus /> Adaugă copil
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : children.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <div key={c.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full font-bold">
                  {c.name.charAt(0)}
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-muted-foreground text-sm">
                    {/* `formatLevel`, nu valoarea brută: de când formularul scrie
                        forma canonică, aici ar fi apărut „incepator" în loc de
                        „Începător". Slug în bază, etichetă cu diacritice pe ecran. */}
                    {childAge(c.birth_date)} ani{c.level ? ` · ${formatLevel(c.level)}` : ''}
                  </div>
                </div>
              </div>
              {(c.allergies || c.emergency_phone) && (
                <div className="text-muted-foreground mt-3 space-y-0.5 text-sm">
                  {c.allergies && <div>Alergii: {c.allergies}</div>}
                  {c.emergency_phone && <div>Contact urgență: {c.emergency_phone}</div>}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/account/child/${c.id}`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm(`Ștergi copilul ${c.name}? Acțiunea este ireversibilă.`)) del.mutate(c.id)
                  }}
                >
                  <Trash2 /> Șterge
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun copil adăugat încă.
        </div>
      )}
    </div>
  )
}
