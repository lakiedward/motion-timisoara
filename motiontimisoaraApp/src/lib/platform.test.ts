import { isNative } from '@/lib/platform'

test('isNative is false in the jsdom (web) test environment', () => {
  expect(isNative()).toBe(false)
})
