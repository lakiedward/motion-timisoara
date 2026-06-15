import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteInviteCode, generateCoachInviteCode, getCoachInviteCodes } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminInviteCodesPage() {
  const qc = useQueryClient()
  const { data: codes = [], isLoading } = useQuery({ queryKey: ['invite-codes'], queryFn: getCoachInviteCodes })

  const gen = useMutation({
    mutationFn: () => generateCoachInviteCode(1),
    onSuccess: (code) => {
      qc.invalidateQueries({ queryKey: ['invite-codes'] })
      navigator.clipboard?.writeText(code)
      toast.success(`Cod generat și copiat: ${code}`)
    },
    onError: () => toast.error('Nu am putut genera codul.'),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteInviteCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite-codes'] }),
    onError: () => toast.error('Nu am putut șterge codul.'),
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Coduri invitație antrenori</h1>
        <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
          <Plus /> Generează cod
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : codes.length ? (
        <ul className="space-y-2">
          {codes.map((c) => {
            const used = c.current_uses >= c.max_uses
            return (
              <li key={c.id} className="bg-card flex items-center justify-between rounded-2xl border p-3">
                <div className="flex items-center gap-3">
                  <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{c.code}</code>
                  <Badge variant={used ? 'outline' : 'success'}>
                    {used ? 'Folosit' : `${c.current_uses}/${c.max_uses}`}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard?.writeText(c.code)
                      toast.success('Copiat.')
                    }}
                  >
                    <Copy />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={del.isPending} onClick={() => del.mutate(c.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun cod. Generează unul pentru a invita un antrenor.
        </div>
      )}
    </div>
  )
}
