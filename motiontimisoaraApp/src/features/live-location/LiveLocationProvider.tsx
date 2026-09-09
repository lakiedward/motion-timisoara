import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { locationRequest, prepareLocationStop } from '@/api/live-location'
import { useAuth } from '@/lib/auth-context'
import { isNative } from '@/lib/platform'
import { SharingController } from './sharing-controller'
import { SharingRegistry } from './sharing-registry'
import { LiveLocationContext } from './live-location-context'
import { startLocationCapture } from './native-location'
import { Button } from '@/components/ui/button'

export function LiveLocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const actorId = user?.role === 'COACH' ? user.id : null
  const registry = useMemo(
    () =>
      new SharingRegistry(
        (actorId) =>
          new SharingController({
            request: (body) => {
              if (!actorId)
                return Promise.reject(
                  new Error('Partajarea este disponibilă antrenorului ședinței.'),
                )
              return locationRequest(body, actorId)
            },
            makeStop: (occurrenceId) => prepareLocationStop(occurrenceId, actorId ?? ''),
            capture: startLocationCapture,
          }),
      ),
    [],
  )
  useSyncExternalStore(registry.subscribe, registry.getSnapshot)
  const controller = registry.forActor(actorId)
  const snapshot = controller.getSnapshot()
  const pending = registry.pendingExcept(controller)
  useEffect(
    () => () => {
      void registry.stopAll()
    },
    [registry],
  )
  useEffect(() => {
    const hidden = () => {
      const state = controller.getSnapshot()
      if (!isNative() && document.hidden && (state.active || state.busy || state.needsStopRetry))
        void controller.stop('Partajarea web s-a oprit când fila a devenit inactivă.')
    }
    const unload = () => controller.dispose()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', unload)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', unload)
      controller.dispose()
    }
  }, [controller])
  const blocked = pending.length > 0
  const value = {
    ...snapshot,
    busy: snapshot.busy || blocked,
    start: (occurrenceId: string) => (blocked ? Promise.resolve() : controller.start(occurrenceId)),
    stop: () => controller.stop(),
  }
  return (
    <LiveLocationContext.Provider value={value}>
      {(snapshot.active || snapshot.stopping || snapshot.needsStopRetry) && (
        <aside
          aria-label="Partajare locație activă"
          className="bg-accent text-accent-foreground sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 border-b px-4 py-3 text-sm"
        >
          <span role="status">
            {snapshot.needsStopRetry
              ? 'Oprirea partajării necesită reîncercare.'
              : snapshot.stopping
                ? 'Se oprește partajarea locației…'
                : 'Locația ta este partajată pentru ședința curentă.'}
          </span>
          <Button
            variant="destructive"
            disabled={snapshot.stopping}
            onClick={() => {
              void controller.stop()
            }}
          >
            {snapshot.needsStopRetry ? 'Reîncearcă oprirea' : 'Oprește locația'}
          </Button>
        </aside>
      )}
      {blocked && (
        <aside
          aria-label="Oprire locație în așteptare"
          className="bg-accent text-accent-foreground sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 border-b px-4 py-3 text-sm"
        >
          <span role="status">
            O partajare anterioară se închide. Oprirea trebuie confirmată înainte de o nouă pornire.
          </span>
          <Button
            variant="destructive"
            disabled={pending.some((item) => item.getSnapshot().stopping)}
            onClick={() => {
              void Promise.all(pending.map((item) => item.stop()))
            }}
          >
            Reîncearcă oprirea
          </Button>
        </aside>
      )}
      {children}
    </LiveLocationContext.Provider>
  )
}
