import { useSyncExternalStore } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  needsHomeScreenForPush,
  promptWebPushPermission,
  pushNotifications,
  supportsPush,
  supportsWebPush,
} from '@/api/notifications'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const nativeCopy = {
  title: 'Notificări pe telefon',
  active: 'Notificările sunt active pe acest telefon.',
  inactive: 'Notificările sunt oprite pe acest telefon.',
  denied:
    'Permisiunea este oprită în Android. Deschide Setări → Aplicații → Motion România → Notificări și permite notificările, apoi apasă „Reîncearcă”.',
  disableHint: 'Poți dezactiva oricând notificările pentru cont, pe toate telefoanele.',
  enableHint:
    'Dacă alegi să le activezi, Android îți va cere permisiunea. Poți continua să folosești aplicația fără notificări.',
}

const webCopy = {
  title: 'Notificări în browser',
  active: 'Notificările sunt active în acest browser.',
  inactive: 'Notificările sunt oprite în acest browser.',
  denied:
    'Browserul blochează notificările pentru Motion. Apasă pe iconița de lângă adresa site-ului, alege Notificări → Permite, apoi apasă „Reîncearcă”.',
  disableHint: 'Poți dezactiva oricând notificările pentru cont, pe toate dispozitivele.',
  enableHint:
    'Dacă alegi să le activezi, browserul îți va cere permisiunea. Le primești și când site-ul este închis, cât timp browserul rulează.',
}

export function PushSettingsCard({ hideWhenEnabled = false }: { hideWhenEnabled?: boolean }) {
  if (supportsPush()) return <PushSettings hideWhenEnabled={hideWhenEnabled} />
  return needsHomeScreenForPush() ? <HomeScreenHint /> : null
}

function HomeScreenHint() {
  return (
    <Card aria-labelledby="push-settings-title">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <BellOff className="text-muted-foreground size-5" aria-hidden="true" />
          <h2 id="push-settings-title" className="font-display text-lg font-bold">
            Notificări pe iPhone
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Pe iPhone, notificările merg din Motion adăugat pe ecranul principal. În Safari apasă
          Distribuie → „Adaugă pe ecranul principal”, deschide Motion de acolo și activează
          notificările.
        </p>
      </CardContent>
    </Card>
  )
}

function PushSettings({ hideWhenEnabled }: { hideWhenEnabled: boolean }) {
  const copy = supportsWebPush() ? webCopy : nativeCopy
  const { user } = useAuth()
  const state = useSyncExternalStore(pushNotifications.subscribe, pushNotifications.getSnapshot)
  const action = useMutation({
    mutationFn: async (kind: 'enable' | 'disable' | 'retry') => {
      if (!user || user.role !== 'PARENT') return
      if (kind === 'enable') await pushNotifications.enable(user.id)
      else if (kind === 'disable' || state.pendingDisable) await pushNotifications.disable(user.id)
      else await pushNotifications.restore(user.id)
    },
    onSuccess: (_, kind) => {
      if (
        hideWhenEnabled &&
        kind === 'enable' &&
        pushNotifications.getSnapshot().status === 'enabled'
      )
        toast.success('Notificările sunt active.', {
          description: 'Le poți opri oricând din Profilul meu.',
        })
    },
  })
  const busy = state.busy || action.isPending
  const enabled = state.status === 'enabled'
  if (hideWhenEnabled && (enabled || state.status === 'loading')) return null

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
            {copy.title}
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
                {enabled ? copy.active : copy.inactive}
              </p>
            )}
            {state.status === 'denied' && (
              <p className="text-muted-foreground text-sm">{copy.denied}</p>
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
                <p className="text-muted-foreground text-sm">{copy.disableHint}</p>
                <Button variant="outline" disabled={busy} onClick={() => action.mutate('disable')}>
                  {busy ? 'Se dezactivează…' : 'Dezactivează notificările'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">{copy.enableHint}</p>
                <Button
                  disabled={busy}
                  onClick={() => {
                    promptWebPushPermission()
                    action.mutate('enable')
                  }}
                >
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
