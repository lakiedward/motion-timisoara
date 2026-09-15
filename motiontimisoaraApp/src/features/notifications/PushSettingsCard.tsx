import { useSyncExternalStore } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { pushNotifications, supportsPush } from '@/api/notifications'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PushSettingsCard() {
  return supportsPush() ? <AndroidPushSettings /> : null
}

function AndroidPushSettings() {
  const { user } = useAuth()
  const state = useSyncExternalStore(pushNotifications.subscribe, pushNotifications.getSnapshot)
  const action = useMutation({
    mutationFn: async (kind: 'enable' | 'disable' | 'retry') => {
      if (!user || user.role !== 'PARENT') return
      if (kind === 'enable') await pushNotifications.enable(user.id)
      else if (kind === 'disable' || state.pendingDisable) await pushNotifications.disable(user.id)
      else await pushNotifications.restore(user.id)
    },
  })
  const busy = state.busy || action.isPending
  const enabled = state.status === 'enabled'

  return (
    <Card aria-labelledby="push-settings-title">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {enabled ? (
            <Bell className="text-primary size-5" aria-hidden="true" />
          ) : (
            <BellOff className="text-muted-foreground size-5" aria-hidden="true" />
          )}
          <h2 id="push-settings-title" className="font-display text-lg font-bold">
            Notificări pe telefon
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === 'loading' ? (
          <div role="status" aria-label="Se încarcă setările notificărilor" className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-32" />
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Primești anunțuri de la organizatori, confirmări de prezență și noutăți despre cursuri
              sau tabere din cluburile copiilor tăi. La apăsare se deschide pagina potrivită.
            </p>
            {state.status !== 'error' && (
              <p role="status" className="text-sm font-medium">
                {enabled
                  ? 'Notificările sunt active pe acest telefon.'
                  : 'Notificările sunt oprite pe acest telefon.'}
              </p>
            )}
            {state.status === 'denied' && (
              <p className="text-muted-foreground text-sm">
                Permisiunea este oprită în Android. Deschide Setări → Aplicații → Motion Timișoara →
                Notificări și permite notificările, apoi apasă „Reîncearcă”.
              </p>
            )}
            {state.error && (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            )}
            {state.status === 'error' || state.status === 'denied' ? (
              <Button variant="outline" disabled={busy} onClick={() => action.mutate('retry')}>
                {busy ? 'Se reîncearcă…' : 'Reîncearcă'}
              </Button>
            ) : state.pendingDisable ? (
              <Button variant="outline" disabled>
                Se dezactivează…
              </Button>
            ) : enabled ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Poți dezactiva oricând notificările pentru cont, pe toate telefoanele.
                </p>
                <Button variant="outline" disabled={busy} onClick={() => action.mutate('disable')}>
                  {busy ? 'Se dezactivează…' : 'Dezactivează notificările'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  Dacă alegi să le activezi, Android îți va cere permisiunea. Poți continua să
                  folosești aplicația fără notificări.
                </p>
                <Button disabled={busy} onClick={() => action.mutate('enable')}>
                  {busy ? 'Se activează…' : 'Activează notificările'}
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
