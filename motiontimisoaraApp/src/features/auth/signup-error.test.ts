import { CONNECTION_ERROR } from './login-error'
import { EMAIL_TAKEN, SIGNUP_FAILED, signupErrorMessage } from './signup-error'

test('an existing account keeps the email already used message', () => {
  expect(signupErrorMessage({ code: 'user_already_exists', status: 422 })).toBe(EMAIL_TAKEN)
  expect(signupErrorMessage({ status: 400, message: 'User already registered' })).toBe(EMAIL_TAKEN)
})

test('a rejected request asks to check the data', () => {
  expect(signupErrorMessage({ code: 'weak_password', status: 422, message: 'Weak' })).toBe(
    SIGNUP_FAILED,
  )
})

test('an unreachable auth server asks to check the connection, never shows Failed to fetch', () => {
  expect(
    signupErrorMessage({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }),
  ).toBe(CONNECTION_ERROR)
  expect(signupErrorMessage({ status: 503, message: 'Service Unavailable' })).toBe(CONNECTION_ERROR)
  expect(signupErrorMessage(new TypeError('Failed to fetch'))).toBe(CONNECTION_ERROR)
  expect(signupErrorMessage(undefined)).toBe(CONNECTION_ERROR)
})
