import { z } from 'zod'
import { AttendanceError, type AttendanceRequest, type AttendanceResult } from '@/api/attendance'

const entrySchema = z
  .object({
    id: z.string().uuid(),
    occurrenceId: z.string().uuid(),
    label: z.string(),
    capturedAt: z.string().datetime(),
    token: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .optional(),
    state: z.enum(['pending', 'rejected', 'confirmed']),
    message: z.string(),
  })
  .refine((entry) => entry.state === 'confirmed' || !!entry.token)

const storedSchema = z.object({
  version: z.literal(1),
  entries: z.array(entrySchema).max(1000),
  syncedAt: z.string().datetime().optional(),
})
export type ScanEntry = z.infer<typeof entrySchema>
type Snapshot = {
  entries: ScanEntry[]
  ready: boolean
  syncing: boolean
  waiting: boolean
  syncedAt: string | null
  error: string | null
}
type Storage = { get: () => Promise<string | null>; set: (value: string) => Promise<void> }
type Sender = (body: AttendanceRequest, actorId: string) => Promise<AttendanceResult>

export class AttendanceQueue {
  private snapshot: Snapshot = {
    entries: [],
    ready: false,
    syncing: false,
    waiting: false,
    syncedAt: null,
    error: null,
  }
  private listeners = new Set<() => void>()
  private writes = Promise.resolve()
  private loading: Promise<void> | null = null
  private active = false
  private running = false

  private actorId: string
  private storage: Storage
  private send: Sender
  private confirmed: (occurrenceId: string) => void

  constructor(
    actorId: string,
    storage: Storage,
    send: Sender,
    confirmed: (occurrenceId: string) => void,
  ) {
    this.actorId = actorId
    this.storage = storage
    this.send = send
    this.confirmed = confirmed
  }

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  async load() {
    if (this.snapshot.ready) return
    if (this.loading) return this.loading
    this.loading = (async () => {
      try {
        const raw = await this.storage.get()
        const stored = raw ? storedSchema.parse(JSON.parse(raw)) : null
        this.publish({
          entries: stored?.entries ?? [],
          syncedAt: stored?.syncedAt ?? null,
          ready: true,
          error: null,
        })
      } catch {
        this.publish({
          error: 'Scanările salvate nu pot fi citite. Reîncearcă înainte să scanezi.',
        })
      }
    })()
    await this.loading
    this.loading = null
  }

  activate() {
    this.active = true
    void this.load().then(() => this.flush())
  }

  deactivate() {
    this.active = false
  }

  private change(transform: (entries: ScanEntry[]) => ScanEntry[], synced = false) {
    const write = this.writes.then(async () => {
      const entries = transform(this.snapshot.entries)
      const syncedAt = synced ? new Date().toISOString() : this.snapshot.syncedAt
      await this.storage.set(
        JSON.stringify({ version: 1, entries, ...(syncedAt ? { syncedAt } : {}) }),
      )
      this.publish({ entries, syncedAt, error: null })
    })
    this.writes = write.catch(() => {})
    return write
  }

  async enqueue(occurrenceId: string, label: string, token: string) {
    await this.load()
    if (!this.snapshot.ready)
      throw new Error(this.snapshot.error ?? 'Stocarea nu este disponibilă.')
    const entry = entrySchema.parse({
      id: crypto.randomUUID(),
      occurrenceId,
      label,
      token,
      capturedAt: new Date().toISOString(),
      state: 'pending',
      message: 'În așteptarea confirmării',
    })
    await this.change((entries) => {
      if (
        entries.some(
          (row) =>
            row.state === 'pending' && row.occurrenceId === occurrenceId && row.token === token,
        )
      )
        return entries
      const retained = [
        ...entries.filter(
          (row) =>
            row.state !== 'confirmed' &&
            !(row.state === 'rejected' && row.occurrenceId === occurrenceId && row.token === token),
        ),
        ...entries.filter((row) => row.state === 'confirmed').slice(-19),
      ]
      if (retained.length >= 1000)
        throw new Error('Lista de scanări este plină. Sincronizează înainte să continui.')
      return [...retained, entry]
    })
    void this.flush()
  }

  async dismiss(id: string) {
    await this.change((entries) =>
      entries.filter((row) => row.id !== id || row.state === 'pending'),
    )
  }

  async retry() {
    await this.load()
    await this.flush()
  }

  async flush() {
    if (this.running || !this.active || !this.snapshot.ready) return
    this.running = true
    this.publish({ syncing: true })
    try {
      while (this.active) {
        const entry = this.snapshot.entries.find((row) => row.state === 'pending')
        if (!entry?.token) {
          this.publish({ waiting: false })
          break
        }
        try {
          const result = await this.send(
            {
              requestId: entry.id,
              occurrenceId: entry.occurrenceId,
              qrToken: entry.token,
              status: 'PRESENT',
            },
            this.actorId,
          )
          const message = `${result.childName ?? 'Copil'} · ${result.outcome === 'duplicate' ? 'Deja procesat — verifică starea din catalog' : 'Prezent confirmat'}`
          await this.change(
            (entries) =>
              entries.map((row) =>
                row.id === entry.id
                  ? { ...row, token: undefined, state: 'confirmed', message }
                  : row,
              ),
            true,
          )
          this.publish({ waiting: false })
          this.confirmed(entry.occurrenceId)
        } catch (error) {
          if (error instanceof AttendanceError && !error.retryable) {
            await this.change(
              (entries) =>
                entries.map((row) =>
                  row.id === entry.id
                    ? { ...row, state: 'rejected', message: error.message }
                    : row,
                ),
              true,
            )
          } else {
            this.publish(
              error instanceof AttendanceError && error.code === 'AUTH'
                ? { waiting: false, error: error.message }
                : { waiting: true, error: null },
            )
            break
          }
        }
      }
    } catch {
      this.publish({ error: 'Nu am putut actualiza scanările salvate. Reîncearcă sincronizarea.' })
    } finally {
      this.running = false
      this.publish({ syncing: false })
    }
  }
}
