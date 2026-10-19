import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, QrCode, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { childAge, deleteChild, getMyChildren, getMyEnrollments, type Child } from '@/api/account'
import { useAuth } from '@/lib/auth-context'
import { formatLevel } from '@/lib/level'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusView } from '@/components/ui/status-view'
import { activeOffersByChild } from './child-offers'

export default function ChildrenPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [pendingDelete, setPendingDelete] = useState<Child | null>(null)
  const {
    data: children = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['children'], queryFn: getMyChildren })
  const enrollments = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: getMyEnrollments,
    enabled: children.length > 0,
  })
  const offers = activeOffersByChild(enrollments.data ?? [])

  const del = useMutation({
    mutationFn: (id: string) => deleteChild(id),
    onSuccess: () => {
      setPendingDelete(null)
      qc.invalidateQueries({ queryKey: ['children'] })
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      toast.success('Copilul a fost șters.')
    },
    onError: () => toast.error('Nu am putut șterge copilul.'),
  })

  const pendingOffers = pendingDelete ? (offers.get(pendingDelete.id) ?? []) : []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Copiii mei</h1>
        <Button asChild>
          <Link to="/account/child/new">
            <Plus /> Adaugă copil
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <StatusView state="loading" rows={2} rowHeight={176} className="gap-4 sm:grid-cols-2" />
      ) : isError ? (
        <StatusView state="error" title="Nu am putut încărca copiii." onRetry={() => refetch()} />
      ) : children.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <ChildCard
              key={c.id}
              child={c}
              offers={offers.get(c.id) ?? []}
              deleting={del.isPending}
              onDelete={() => setPendingDelete(c)}
            />
          ))}
        </div>
      ) : (
        <StatusView
          state="empty"
          title="Niciun copil adăugat încă."
          text="Adaugă copilul ca să-l poți înscrie la cursuri."
          action={
            <Button asChild className="mt-3">
              <Link to="/account/child/new">
                <Plus /> Adaugă primul copil
              </Link>
            </Button>
          }
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={pendingDelete ? `Ștergi copilul ${pendingDelete.name}?` : ''}
        description="Acțiunea este ireversibilă."
        confirmLabel="Șterge"
        destructive
        pending={del.isPending}
        onConfirm={() => pendingDelete && del.mutate(pendingDelete.id)}
      >
        {pendingOffers.length ? (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {pendingDelete?.name} are înscrieri active: {pendingOffers.join(', ')}. Dacă îl ștergi, se
            șterg și înscrierile și prezența lui.
          </p>
        ) : enrollments.isError ? (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            Nu am putut verifica înscrierile copilului. Dacă are înscrieri, se șterg și ele.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

function ChildCard({
  child: c,
  offers,
  deleting,
  onDelete,
}: {
  child: Child
  offers: string[]
  deleting: boolean
  onDelete: () => void
}) {
  return (
    <Card className="gap-4 px-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-full font-bold">
          {c.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold break-words">{c.name}</div>
          <div className="text-muted-foreground text-sm">
            {childAge(c.birth_date)} ani{c.level ? ` · ${formatLevel(c.level)}` : ''}
          </div>
        </div>
      </div>
      {(offers.length > 0 || c.allergies || c.emergency_phone) && (
        <div className="text-muted-foreground space-y-0.5 text-sm">
          {offers.length > 0 && <div>Înscris la: {offers.join(', ')}</div>}
          {c.allergies && <div>Alergii: {c.allergies}</div>}
          {c.emergency_phone && <div>Contact urgență: {c.emergency_phone}</div>}
        </div>
      )}
      <div className="mt-auto grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
        <Button asChild variant="outline">
          <Link to={`/account/child/${c.id}/qr`}>
            <QrCode className="hidden lg:inline" /> Cod QR
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/account/child/${c.id}`}>
            <Pencil className="hidden lg:inline" /> Editează
          </Link>
        </Button>
        <Button variant="ghost" className="text-destructive" disabled={deleting} onClick={onDelete}>
          <Trash2 className="hidden lg:inline" /> Șterge
        </Button>
      </div>
    </Card>
  )
}
