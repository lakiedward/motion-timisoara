import {
  LocationError,
  type LocationRequest,
  type LocationResponse,
  type LocationPoint,
} from '@/api/live-location'

export type ActiveSharing = {
  occurrenceId: string
  sessionId: string
  expiresAt: string
  lastSentAt: string | null
}
export type SharingState = {
  active: ActiveSharing | null
  busy: boolean
  stopping: boolean
  error: string | null
  needsStopRetry: boolean
}
export type SharingDependencies = {
  request: (body: LocationRequest) => Promise<LocationResponse>
  makeStop: (occurrenceId: string) => Promise<(sessionId: string) => Promise<unknown>>
  capture: (
    expiresAt: string,
    point: (point: Omit<LocationPoint, 'updatedAt'>) => void,
    error: (error: Error) => void,
  ) => Promise<() => Promise<void>>
  now?: () => number
}

export class SharingController {
  private state: SharingState = {
    active: null,
    busy: false,
    stopping: false,
    error: null,
    needsStopRetry: false,
  }
  private listeners = new Set<() => void>()
  private generation = 0
  private cancelCapture: (() => Promise<void>) | null = null
  private remoteStop: (() => Promise<unknown>) | null = null
  private deadline: ReturnType<typeof setTimeout> | null = null
  private sending: number | null = null
  private starting: Promise<string | null> | null = null
  private stopping: Promise<void> | null = null
  private lastAttempt = -Infinity
  private now: () => number
  private dependencies: SharingDependencies

  constructor(dependencies: SharingDependencies) {
    this.dependencies = dependencies
    this.now = dependencies.now ?? Date.now
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private change(next: Partial<SharingState>) {
    this.state = { ...this.state, ...next }
    this.listeners.forEach((notify) => notify())
  }

  start = async (occurrenceId: string) => {
    if (this.state.busy || this.state.active || this.state.needsStopRetry) return
    const generation = ++this.generation
    this.change({ busy: true, error: null })
    const starting = this.begin(occurrenceId, generation)
    this.starting = starting
    const failure = await starting
    if (this.starting === starting) this.starting = null
    if (generation !== this.generation) return
    if (failure) await this.stop(failure)
    else this.change({ busy: false })
  }

  private async begin(occurrenceId: string, generation: number): Promise<string | null> {
    try {
      const stop = await this.dependencies.makeStop(occurrenceId)
      if (generation !== this.generation) return null
      const session = await this.dependencies.request({
        action: 'start',
        occurrenceId,
        requestId: crypto.randomUUID(),
        consent: true,
      })
      this.remoteStop = () => stop(session.sessionId)
      if (generation !== this.generation) return null
      if (Date.parse(session.expiresAt) <= this.now()) throw new Error('Ședința s-a încheiat.')
      this.lastAttempt = -Infinity
      this.change({
        active: {
          occurrenceId,
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
          lastSentAt: null,
        },
      })
      this.deadline = setTimeout(
        () => {
          void this.stop('Partajarea s-a încheiat la ora stabilită.')
        },
        Math.min(Date.parse(session.expiresAt) - this.now(), 2147483647),
      )
      this.cancelCapture = await this.dependencies.capture(
        session.expiresAt,
        (point) => {
          void this.send(point, generation)
        },
        (error) => {
          if (generation === this.generation) void this.stop(error.message)
        },
      )
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Nu am putut porni partajarea.'
    }
  }

  private async send(point: Omit<LocationPoint, 'updatedAt'>, generation: number) {
    const active = this.state.active
    if (generation !== this.generation || !active || this.sending === generation) return
    if (this.now() >= Date.parse(active.expiresAt)) {
      await this.stop('Partajarea s-a încheiat.')
      return
    }
    if (this.now() - this.lastAttempt < 15000 || this.now() - Date.parse(point.capturedAt) > 120000)
      return
    this.sending = generation
    this.lastAttempt = this.now()
    try {
      await this.dependencies.request({
        action: 'update',
        occurrenceId: active.occurrenceId,
        sessionId: active.sessionId,
        ...point,
      })
      if (generation === this.generation)
        this.change({ active: { ...active, lastSentAt: point.capturedAt }, error: null })
    } catch (error) {
      if (generation !== this.generation) return
      const terminal =
        error instanceof LocationError &&
        ['FORBIDDEN', 'UNAUTHORIZED', 'SESSION_NOT_FOUND', 'SESSION_EXPIRED'].includes(error.code)
      if (terminal) await this.stop(error.message)
      else
        this.change({
          error:
            'Poziția nu a fost trimisă. Vom încerca din nou cu următoarea poziție; istoricul nu se păstrează.',
        })
    } finally {
      if (this.sending === generation) this.sending = null
    }
  }

  private async cleanup() {
    const cancel = this.cancelCapture
    const remoteStop = this.remoteStop
    this.cancelCapture = null
    this.remoteStop = null
    const results = await Promise.allSettled([
      Promise.resolve().then(() => cancel?.()),
      Promise.resolve().then(() => remoteStop?.()),
    ])
    if (results[0].status === 'rejected') this.cancelCapture = cancel
    if (results[1].status === 'rejected') this.remoteStop = remoteStop
  }

  stop = (reason?: string): Promise<void> => {
    if (this.stopping) return this.stopping
    ++this.generation
    if (this.deadline) clearTimeout(this.deadline)
    this.deadline = null
    this.change({ active: null, busy: true, stopping: true, error: reason ?? null })
    const starting = this.starting
    this.stopping = (async () => {
      await this.cleanup()
      if (starting) {
        await starting
        await this.cleanup()
      }
      const failed = !!(this.cancelCapture || this.remoteStop)
      this.change({
        busy: false,
        stopping: false,
        needsStopRetry: failed,
        ...(failed
          ? {
              error:
                'Oprirea nu a putut fi confirmată complet. Reîncearcă oprirea înainte de a închide aplicația.',
            }
          : {}),
      })
    })().finally(() => {
      this.stopping = null
    })
    return this.stopping
  }

  dispose = () => {
    void this.stop()
  }
}
