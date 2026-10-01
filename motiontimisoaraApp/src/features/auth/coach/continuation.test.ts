import { coachContinuation, coachReturnPath, isCoachContinuation } from './continuation'

test.each([
  'https://evil.test',
  '//evil.test',
  '/login',
  '/signup',
  '/register',
  '/register-coach',
  '/register-club',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/register-coach?returnUrl=%2Fcoach',
  '/REGISTER-COACH/',
  '/%72egister-coach',
])('rejects external and recursive auth completion destination %s', (path) => {
  expect(coachReturnPath(path)).toBeUndefined()
  expect(coachContinuation(path)).toBe('/register-coach')
})

test('preserves public destination, query and hash through one coach continuation', () => {
  const destination = '/cursuri/abc?tab=orar#pret'
  expect(coachReturnPath(destination)).toBe(destination)
  expect(coachContinuation(destination)).toBe(
    `/register-coach?returnUrl=${encodeURIComponent(destination)}`,
  )
})

test.each([
  ['/register-coach', true],
  ['/register-coach?returnUrl=%2Fcursuri', true],
  ['/register', false],
  ['/register-coach-extra', false],
  ['/register-coach/nested', false],
  ['https://evil.test/register-coach', false],
  [undefined, false],
] as const)('only the exact local coach path is a profile handoff: %s', (path, expected) => {
  expect(isCoachContinuation(path)).toBe(expected)
})
