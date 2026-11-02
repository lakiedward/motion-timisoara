import { expect, test } from 'vitest'

import { adminUserSchema, toPatch } from './user-edit'

const parse = (v: { name: string; phone: string; bio: string }) => adminUserSchema.safeParse(v)

test('the name needs at least two characters', () => {
  expect(parse({ name: ' A ', phone: '', bio: '' }).success).toBe(false)
  expect(parse({ name: 'Ana', phone: '', bio: '' }).success).toBe(true)
})

test('the phone is optional, spaces are removed and letters are refused', () => {
  const ok = parse({ name: 'Ana', phone: '0722 000 000', bio: '' })
  expect(ok.success && ok.data.phone).toBe('0722000000')
  expect(parse({ name: 'Ana', phone: 'abc', bio: '' }).success).toBe(false)
})

test('the patch leaves out the phone when it was never read', () => {
  const values = { name: 'Ana', phone: '', bio: 'x' }
  expect(toPatch(values, { role: 'PARENT', phoneKnown: false })).toEqual({ name: 'Ana' })
  expect(toPatch(values, { role: 'PARENT', phoneKnown: true })).toEqual({
    name: 'Ana',
    phone: null,
  })
})

test('only coaches get a bio, and an empty bio is saved as null', () => {
  expect(
    toPatch({ name: 'Ion', phone: '', bio: '  ' }, { role: 'COACH', phoneKnown: false }),
  ).toEqual({ name: 'Ion', bio: null })
})
