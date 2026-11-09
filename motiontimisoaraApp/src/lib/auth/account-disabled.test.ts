import { afterEach, expect, it, vi } from 'vitest'
import { createAccountDisabledFetch, onAccountDisabled } from './account-disabled'

const base = 'https://project.supabase.co'
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let stop: (() => void) | undefined
afterEach(() => stop?.())

async function call(url: string, response: Response) {
  const reported = vi.fn()
  stop = onAccountDisabled(reported)
  const wrapped = createAccountDisabledFetch(async () => response)
  const result = await wrapped(url)
  return { reported, result }
}

it('reports a data request refused for a disabled account and keeps the body readable', async () => {
  const { reported, result } = await call(
    `${base}/rest/v1/courses?select=*`,
    json(403, { code: 'account_disabled', message: 'Contul a fost dezactivat.' }),
  )
  expect(reported).toHaveBeenCalledTimes(1)
  expect(await result.json()).toEqual({
    code: 'account_disabled',
    message: 'Contul a fost dezactivat.',
  })
})

it('ignores deleted accounts, other refusals and successful requests', async () => {
  for (const [url, response] of [
    [`${base}/rest/v1/rpc/my_profile`, json(403, { code: 'account_deleted' })],
    [`${base}/rest/v1/courses`, json(403, { code: '42501', message: 'permission denied' })],
    [`${base}/rest/v1/courses`, json(200, [])],
    [`${base}/storage/v1/object/x`, json(403, { code: 'account_disabled' })],
  ] as const) {
    const { reported } = await call(url, response)
    expect(reported).not.toHaveBeenCalled()
    stop?.()
  }
})

it('reports a refresh or user lookup refused by Auth because the account is banned', async () => {
  for (const [url, response] of [
    [`${base}/auth/v1/token?grant_type=refresh_token`, json(400, { code: 'user_banned' })],
    [`${base}/auth/v1/token?grant_type=refresh_token`, json(400, { error_code: 'user_banned' })],
    [`${base}/auth/v1/user`, json(403, { code: 'user_banned' })],
  ] as const) {
    const { reported } = await call(url, response)
    expect(reported).toHaveBeenCalledTimes(1)
    stop?.()
  }
})

it('leaves a banned password sign-in to the login form', async () => {
  const { reported } = await call(
    `${base}/auth/v1/token?grant_type=password`,
    json(400, { code: 'user_banned' }),
  )
  expect(reported).not.toHaveBeenCalled()
})

it('reads the URL of Request and URL inputs', async () => {
  const reported = vi.fn()
  stop = onAccountDisabled(reported)
  const wrapped = createAccountDisabledFetch(async () => json(403, { code: 'account_disabled' }))
  await wrapped(new URL(`${base}/rest/v1/courses`))
  await wrapped(new Request(`${base}/rest/v1/courses`))
  expect(reported).toHaveBeenCalledTimes(2)
})
