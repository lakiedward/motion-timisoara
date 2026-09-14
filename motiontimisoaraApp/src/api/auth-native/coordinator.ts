import { validReturnPath } from '@/lib/auth/return-path'

export const NATIVE_CALLBACK = 'com.motiontimisoara.app://auth/callback'
export const FLOW_LIFETIME_MS = 10 * 60 * 1000
export const GOOGLE_ERROR = 'Nu am putut finaliza autentificarea cu Google. Încearcă din nou.'

export type FlowState = 'idle' | 'preparing' | 'awaiting' | 'exchanging' | 'committing'
export type PendingFlow = {
  nonce: string
  returnUrl?: string
  createdAt: number
  status: 'awaiting' | 'exchanging'
}

export interface OAuthDependencies<Session> {
  read(): Promise<PendingFlow | null>
  write(flow: PendingFlow): Promise<void>
  clear(): Promise<void>
  clearVerifier(): Promise<void>
  prepare(redirectTo: string): Promise<string>
  open(url: string): Promise<void>
  close(): Promise<void>
  exchange(code: string): Promise<Session>
  hasSession(): Promise<boolean>
  commit(session: Session): Promise<void>
  nonce(): string
  now(): number
  complete(returnUrl?: string): void
  error(message: string): void
}

export function createOAuthCoordinator<Session>(deps: OAuthDependencies<Session>) {
  let state: FlowState = 'idle'
  let generation = 0
  let tail: Promise<unknown> = Promise.resolve()
  const listeners = new Set<() => void>()
  const update = (next: FlowState) => {
    state = next
    listeners.forEach((listener) => listener())
  }
  const serialized = <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work)
    tail = result.catch(() => undefined)
    return result
  }
  const clear = async () => {
    await deps.clear()
    await deps.clearVerifier()
    update('idle')
  }
  const fresh = (flow: PendingFlow) =>
    typeof flow.nonce === 'string' &&
    flow.nonce.length >= 32 &&
    Number.isFinite(flow.createdAt) &&
    deps.now() >= flow.createdAt &&
    deps.now() - flow.createdAt < FLOW_LIFETIME_MS &&
    flow.status === 'awaiting'

  return {
    run: serialized,
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    restore: () =>
      serialized(async () => {
        const flow = await deps.read()
        if (flow && fresh(flow)) update('awaiting')
        else if (flow) await clear()
      }),
    start: (returnUrl?: string) => {
      const startedGeneration = generation
      return serialized(async () => {
        if (startedGeneration !== generation) return
        const existing = await deps.read()
        if (existing && fresh(existing)) {
          update('awaiting')
          return
        }
        await clear()
        if (await deps.hasSession()) return
        if (startedGeneration !== generation) return
        update('preparing')
        try {
          const flow: PendingFlow = {
            nonce: deps.nonce(),
            returnUrl: validReturnPath(returnUrl),
            createdAt: deps.now(),
            status: 'awaiting',
          }
          const redirect = new URL(NATIVE_CALLBACK)
          redirect.searchParams.set('nonce', flow.nonce)
          const url = await deps.prepare(redirect.toString())
          if (startedGeneration !== generation) return
          await deps.write(flow)
          if (startedGeneration !== generation) return
          update('awaiting')
          await deps.open(url)
        } catch {
          await clear()
          deps.error(GOOGLE_ERROR)
        }
      })
    },
    cancel: () => {
      if (state === 'committing') return tail.then(() => undefined)
      generation += 1
      return serialized(async () => {
        await clear()
        await deps.close().catch(() => undefined)
      })
    },
    authenticate: <T>(work: () => Promise<T>): Promise<T> => {
      generation += 1
      return serialized(async () => {
        await clear()
        await deps.close().catch(() => undefined)
        return work()
      })
    },
    receive: (raw: string) => {
      const callbackGeneration = generation
      return serialized(async () => {
        if (callbackGeneration !== generation) return false
        let url: URL
        try {
          url = new URL(raw)
        } catch {
          return false
        }
        if (
          url.protocol !== 'com.motiontimisoara.app:' ||
          url.host !== 'auth' ||
          url.pathname !== '/callback' ||
          url.username ||
          url.password ||
          url.hash
        )
          return false
        const flow = await deps.read()
        if (
          !flow ||
          url.searchParams.getAll('nonce').length !== 1 ||
          url.searchParams.get('nonce') !== flow.nonce
        )
          return false
        if (!fresh(flow)) {
          await clear()
          deps.error(GOOGLE_ERROR)
          return false
        }
        const codes = url.searchParams.getAll('code')
        const providerError = url.searchParams.has('error') || url.searchParams.has('error_code')
        if (!providerError && (codes.length !== 1 || !codes[0] || codes[0].length > 4096))
          return false
        await deps.write({ ...flow, status: 'exchanging' })
        update('exchanging')
        try {
          if (providerError) throw new Error(GOOGLE_ERROR)
          if (callbackGeneration !== generation) return false
          if (await deps.hasSession()) return false
          const session = await deps.exchange(codes[0])
          const hasSession = await deps.hasSession()
          if (callbackGeneration !== generation || hasSession) return false
          update('committing')
          await deps.commit(session)
          if (callbackGeneration === generation) deps.complete(validReturnPath(flow.returnUrl))
          return true
        } catch {
          if (callbackGeneration === generation) deps.error(GOOGLE_ERROR)
          return false
        } finally {
          await clear()
          await deps.close().catch(() => undefined)
        }
      })
    },
  }
}
