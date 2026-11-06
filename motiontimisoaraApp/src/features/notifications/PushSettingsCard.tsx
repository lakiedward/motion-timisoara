import { useSyncExternalStore, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  needsHomeScreenForPush,
  promptWebPushPermission,
  pushNotifications,
  supportsPush,
  supportsWebPush,
  webPushPermissionGranted,
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

const TITLE_ID = 'push-settings-title'
const LOADING_LABEL = 'Se încarcă setările notificărilor'
const IPHONE_TITLE = 'Notificări pe iPhone'
const IPHONE_STEPS =
  'Pe iPhone, notificările merg din Motion adăugat pe ecranul principal. În Safari apasă Distribuie → „Adaugă pe ecranul principal”, deschide Motion de acolo și activează notificările.'

export function PushSettingsCard({ hideWhenEnabled = false }: { hideWhenEnabled?: boolean }) {
  if (supportsPush()) return hideWhenEnabled ? <DashboardPushPrompt /> : <PushSettings />
  if (!needsHomeScreenForPush()) return null
  return hideWhenEnabled ? (
    <PushStrip icon={<BellOff className="size-5" />} title={IPHONE_TITLE}>
      <p className="text-muted-foreground col-span-2 text-sm sm:col-span-1 sm:col-start-2">
        {IPHONE_STEPS}
      </p>
    </PushStrip>
  ) : (
    <PushCard
      icon={<BellOff className="text-muted-foreground size-5" aria-hidden="true" />}
      title={IPHONE_TITLE}
    >
      <p className="text-muted-foreground text-sm">{IPHONE_STEPS}</p>
    </PushCard>
  )
}

function usePushControls({ confirmOnEnable }: { confirmOnEnable: boolean }) {
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
        confirmOnEnable &&
        kind === 'enable' &&
        pushNotifications.getSnapshot().status === 'enabled'
      )
        toast.success('Notificările sunt active.', {
          description: 'Le poți opri oricând din Profilul meu.',
        })
    },
  })
  const enable = () => {
    promptWebPushPermission()
    action.mutate('enable')
  }
  return {
    copy,
    state,
    busy: state.busy || action.isPending,
    enabled: state.status === 'enabled',
    enable,
    disable: () => action.mutate('disable'),
    retry: () => action.mutate('retry'),
  }
}

function PushCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={TITLE_ID}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {icon}
            <h2 id={TITLE_ID} className="font-display text-lg font-bold">
              {title}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </section>
  )
}

function PushStrip({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={TITLE_ID}>
      <div className="bg-card grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-xl border p-6 sm:grid-cols-[auto_1fr_auto] sm:gap-x-4">
        <span
          aria-hidden="true"
          className="text-primary sm:bg-primary/10 sm:row-span-2 sm:grid sm:size-11 sm:place-items-center sm:rounded-xl"
        >
          {icon}
        </span>
        <h2 id={TITLE_ID} className="font-display text-lg font-bold">
          {title}
        </h2>
        {children}
      </div>
    </section>
  )
}

function DashboardPushPrompt() {
  const { copy, state, busy, enabled, enable, retry } = usePushControls({ confirmOnEnable: true })
  if (enabled) return null
  if (state.status === 'loading')
    return supportsWebPush() && !webPushPermissionGranted() ? (
      <div
        role="status"
        aria-label={LOADING_LABEL}
        className="bg-card grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-xl border p-6 sm:grid-cols-[auto_1fr_auto] sm:gap-x-4"
      >
        <Skeleton className="size-5 sm:row-span-2 sm:size-11 sm:rounded-xl" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="col-span-2 h-4 w-full sm:col-span-1 sm:col-start-2 sm:w-64" />
        <Skeleton className="h-touch-target col-span-2 mt-2 w-48 sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0" />
      </div>
    ) : null

  const blocked = state.status === 'error' || state.status === 'denied'
  return (
    <PushStrip icon={<BellOff className="size-5" />} title={copy.title}>
      <div className="col-span-2 space-y-1 sm:col-span-1 sm:col-start-2">
        {state.status !== 'error' && (
          <p role="status" className="text-muted-foreground text-sm">
            {copy.inactive}
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
      </div>
      <div className="col-span-2 mt-2 sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0">
        {blocked ? (
          <Button variant="outline" disabled={busy} onClick={retry}>
            {busy ? 'Se reîncearcă…' : 'Reîncearcă'}
          </Button>
        ) : (
          <Button disabled={busy} onClick={enable}>
            {busy ? 'Se activează…' : 'Activează notificările'}
          </Button>
        )}
      </div>
    </PushStrip>
  )
}

function PushSettings() {
  const { copy, state, busy, enabled, enable, disable, retry } = usePushControls({
    confirmOnEnable: false,
  })
  const icon = enabled ? (
    <Bell className="text-primary size-5" aria-hidden="true" />
  ) : (
    <BellOff className="text-muted-foreground size-5" aria-hidden="true" />
  )

  return (
    <PushCard icon={icon} title={copy.title}>
      {state.status === 'loading' ? (
        <div role="status" aria-label={LOADING_LABEL} className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-touch-target w-48" />
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
            <Button variant="outline" disabled={busy} onClick={retry}>
              {busy ? 'Se reîncearcă…' : 'Reîncearcă'}
            </Button>
          ) : state.pendingDisable ? (
            <Button variant="outline" disabled>
              Se dezactivează…
            </Button>
          ) : enabled ? (
            <>
              <p className="text-muted-foreground text-sm">{copy.disableHint}</p>
              <Button variant="outline" disabled={busy} onClick={disable}>
                {busy ? 'Se dezactivează…' : 'Dezactivează notificările'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{copy.enableHint}</p>
              <Button disabled={busy} onClick={enable}>
                {busy ? 'Se activează…' : 'Activează notificările'}
              </Button>
            </>
          )}
        </>
      )}
    </PushCard>
  )
}
