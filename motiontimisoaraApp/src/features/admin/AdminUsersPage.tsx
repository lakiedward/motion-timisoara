import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getAllUsers, setUserEnabled } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'highlight'> = {
  ADMIN: 'highlight',
  CLUB: 'default',
  COACH: 'success',
  PARENT: 'secondary',
}

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: getAllUsers })
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setUserEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: () => toast.error('Nu am putut actualiza utilizatorul.'),
  })

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Utilizatori</h1>
      {isLoading ? (
        <Skeleton className="h-64 rounded-3xl" />
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-3xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Nume</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="text-muted-foreground px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_VARIANT[u.role] ?? 'secondary'}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.enabled ? (
                      <span className="text-success">Activ</span>
                    ) : (
                      <span className="text-destructive">Dezactivat</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'ADMIN' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ id: u.id, enabled: !u.enabled })}
                      >
                        {u.enabled ? 'Dezactivează' : 'Activează'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
