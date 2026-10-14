import { CONNECTION_ERROR, WRONG_CREDENTIALS, loginErrorMessage } from './login-error'

test('invalid credentials keep the wrong email or password message', () => {
  expect(loginErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe(WRONG_CREDENTIALS)
  expect(loginErrorMessage({ status: 400, message: 'Invalid login credentials' })).toBe(
    WRONG_CREDENTIALS,
  )
})

test('an unreachable auth server asks to check the connection and retry', () => {
  expect(loginErrorMessage({ status: 0, message: 'Failed to fetch' })).toBe(CONNECTION_ERROR)
  expect(loginErrorMessage({ status: 503, message: 'Service Unavailable' })).toBe(CONNECTION_ERROR)
  expect(loginErrorMessage(new TypeError('Failed to fetch'))).toBe(CONNECTION_ERROR)
  expect(loginErrorMessage(undefined)).toBe(CONNECTION_ERROR)
})
