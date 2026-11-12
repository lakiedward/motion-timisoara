import { entranceUrl, isEntranceToken, readScannedEntrance } from './entrance-code'

const TOKEN = '0123456789abcdef0123456789abcdef'

test('linkul printat folosește originea site-ului deschis', () => {
  expect(entranceUrl('https://master--motiontimisoara.netlify.app', TOKEN)).toBe(
    `https://master--motiontimisoara.netlify.app/prezenta/${TOKEN}`,
  )
  expect(entranceUrl('http://127.0.0.1:3017/', TOKEN)).toBe(
    `http://127.0.0.1:3017/prezenta/${TOKEN}`,
  )
})

test('în aplicația nativă linkul trimite la site-ul public', () => {
  expect(entranceUrl('capacitor://localhost', TOKEN)).toBe(
    `https://motionromania.ro/prezenta/${TOKEN}`,
  )
})

test('scanerul din cont recunoaște linkul de la intrare, de pe orice domeniu al site-ului', () => {
  expect(readScannedEntrance(`https://motionromania.ro/prezenta/${TOKEN}`)).toEqual({
    kind: 'entrance',
    token: TOKEN,
  })
  expect(
    readScannedEntrance(` https://master--motiontimisoara.netlify.app/prezenta/${TOKEN}/ `),
  ).toEqual({
    kind: 'entrance',
    token: TOKEN,
  })
  expect(readScannedEntrance(TOKEN)).toEqual({ kind: 'entrance', token: TOKEN })
})

test('codul unui copil și alte coduri sunt deosebite de codul de la intrare', () => {
  expect(readScannedEntrance(`MT1:${TOKEN}`)).toEqual({ kind: 'child' })
  expect(readScannedEntrance('https://exemplu.ro/altceva')).toEqual({ kind: 'unknown' })
  expect(readScannedEntrance(`javascript:alert(1)//prezenta/${TOKEN}`)).toEqual({ kind: 'unknown' })
  expect(readScannedEntrance('text oarecare')).toEqual({ kind: 'unknown' })
  expect(readScannedEntrance(`https://motionromania.ro/prezenta/${TOKEN.toUpperCase()}`)).toEqual({
    kind: 'unknown',
  })
})

test('tokenul din ruta trebuie să aibă 32 de caractere hex', () => {
  expect(isEntranceToken(TOKEN)).toBe(true)
  expect(isEntranceToken('abc')).toBe(false)
  expect(isEntranceToken(undefined)).toBe(false)
})
