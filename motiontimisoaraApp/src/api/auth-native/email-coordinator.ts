import type { Session } from '@supabase/supabase-js'
import { createRecoveryGrant } from '@/lib/auth/recovery-grant'

export const EMAIL_CALLBACK = 'com.motiontimisoara.app://auth/email-callback'
export const EMAIL_FLOW_LIFETIME_MS = 5 * 60 * 1000
export const EMAIL_LINK_ERROR =
  'Linkul este invalid, a expirat sau a fost deja folosit. Solicită un link nou din această aplicație.'
export type EmailKind = 'recovery' | 'signup'
export type EmailFlow = {
  kind: EmailKind
  nonce: string
  createdAt: number
  status: 'awaiting' | 'exchanging'
}
export type EmailResult = { kind: EmailKind } | { error: string }

export interface EmailDependencies {
  run<T>(work: () => Promise<T>): Promise<T>
  read(): Promise<EmailFlow | null>
  write(flow: EmailFlow): Promise<void>
  clearPending(): Promise<void>
  clearSession(): Promise<void>
  exchange(code: string, kind: EmailKind): Promise<Session>
  session(): Promise<Session | null>
  update(password: string): Promise<{ error: { message: string } | null }>
  nonce(): string
  now(): number
  result(result: EmailResult): void
}

export function isEmailCallback(raw: string) {
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'com.motiontimisoara.app:' &&
      url.host === 'auth' &&
      url.pathname === '/email-callback' &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

export function createEmailCoordinator(deps: EmailDependencies) {
  const grant = createRecoveryGrant(deps.now)
  const clear = async () => {
    grant.clear()
    await deps.clearPending()
    await deps.clearSession()
  }
  const fresh = (flow: EmailFlow) =>
    (flow.kind === 'recovery' || flow.kind === 'signup') &&
    typeof flow.nonce === 'string' &&
    /^[a-f0-9]{64}$/.test(flow.nonce) &&
    Number.isFinite(flow.createdAt) &&
    deps.now() >= flow.createdAt &&
    deps.now() - flow.createdAt < EMAIL_FLOW_LIFETIME_MS &&
    flow.status === 'awaiting'

  return {
    send<T extends { error: unknown }>(kind: EmailKind, prepare: (redirect: string) => Promise<T>) {
      return deps.run(async () => {
        await clear()
        const flow: EmailFlow = {
          kind,
          nonce: deps.nonce(),
          createdAt: deps.now(),
          status: 'awaiting',
        }
        const url = new URL(EMAIL_CALLBACK)
        url.searchParams.set('nonce', flow.nonce)
        try {
          await deps.write(flow)
          const result = await prepare(url.toString())
          if (result.error) await clear()
          return result
        } catch (error) {
          await clear()
          throw error
        }
      })
    },
    restore() {
      return deps.run(async () => {
        const flow = await deps.read()
        if (flow && !fresh(flow)) await clear()
      })
    },
    receive(raw: string) {
      if (!isEmailCallback(raw)) return Promise.resolve(false)
      return deps.run(async () => {
        const url = new URL(raw)
        try {
          const flow = await deps.read()
          const codes = url.searchParams.getAll('code')
          if (
            !flow ||
            !fresh(flow) ||
            url.hash ||
            url.searchParams.has('error') ||
            url.searchParams.has('error_code') ||
            url.searchParams.getAll('nonce').length !== 1 ||
            url.searchParams.get('nonce') !== flow.nonce ||
            codes.length !== 1 ||
            !codes[0] ||
            codes[0].length > 4096 ||
            [...url.searchParams.keys()].some((key) => !['code', 'nonce'].includes(key))
          ) {
            deps.result({ error: EMAIL_LINK_ERROR })
            return false
          }
          grant.clear()
          await deps.write({ ...flow, status: 'exchanging' })
          const session = await deps.exchange(codes[0], flow.kind)
          await deps.clearPending()
          if (flow.kind === 'recovery') grant.issue(session)
          else await deps.clearSession()
          deps.result({ kind: flow.kind })
          return true
        } catch {
          await clear()
          deps.result({ error: EMAIL_LINK_ERROR })
          return false
        }
      })
    },
    ready() {
      return deps.run(async () => grant.valid(await deps.session()))
    },
    updatePassword(password: string) {
      return deps.run(async () => {
        try {
          if (!grant.valid(await deps.session())) return { error: { message: EMAIL_LINK_ERROR } }
          grant.clear()
          return await deps.update(password)
        } finally {
          await clear()
        }
      })
    },
  }
}
