import { oauthCallbackUrl, validReturnPath } from './return-path'

test('oauthCallbackUrl matches the Google web redirect contract', () => {
  expect(oauthCallbackUrl('http://127.0.0.1:3017')).toBe('http://127.0.0.1:3017/auth/callback')
  expect(oauthCallbackUrl('http://127.0.0.1:3017/', '/account/checkout')).toBe(
    'http://127.0.0.1:3017/auth/callback?returnUrl=%2Faccount%2Fcheckout',
  )
})

test('oauthCallbackUrl ignores forged return destinations', () => {
  expect(oauthCallbackUrl('https://motiontimisoara.com', 'https://evil.test/phish')).toBe(
    'https://motiontimisoara.com/auth/callback',
  )
  expect(validReturnPath('https://evil.test/phish')).toBeUndefined()
})
