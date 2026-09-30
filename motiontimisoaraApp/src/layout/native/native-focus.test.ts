import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { revealNativeInput } from './native-focus'

function createForm(top = 127, height = 279) {
  document.body.innerHTML =
    '<main><form><input id="email" type="email"><input id="password" type="password"></form></main><input id="outside">'
  const content = document.querySelector('main')!
  const email = document.getElementById('email') as HTMLInputElement
  const password = document.getElementById('password') as HTMLInputElement
  content.style.scrollPaddingTop = '8px'
  content.style.scrollPaddingBottom = '8px'
  Object.defineProperties(content, {
    clientHeight: { configurable: true, value: height },
    scrollHeight: { configurable: true, value: 511 },
  })
  vi.spyOn(content, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, top, 402, height),
  )
  vi.spyOn(email, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(24, 351 - content.scrollTop, 354, 36),
  )
  vi.spyOn(password, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(24, 445 - content.scrollTop, 354, 36),
  )
  return { content, email, password }
}

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}))
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('native portrait geometry reveals offscreen Password before an accessory focus change', () => {
  const { content, email, password } = createForm()
  email.focus()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(83)
  expect(email.getBoundingClientRect().top).toBeGreaterThanOrEqual(135)
  expect(password.getBoundingClientRect().bottom).toBeLessThanOrEqual(398)
  expect(document.activeElement).toBe(email)
  expect(window.scrollTo).not.toHaveBeenCalled()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(83)
})

test('narrow landscape prioritizes the current field when adjacent fields cannot fit', () => {
  const { content, password } = createForm(45, 72)
  password.focus()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(372)
  expect(password.getBoundingClientRect().top).toBeGreaterThanOrEqual(53)
  expect(password.getBoundingClientRect().bottom).toBeLessThanOrEqual(109)
  expect(document.activeElement).toBe(password)
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(372)
})

test('an adjacent center can remain assistable until its own focus reveals the full field', () => {
  const { content, email, password } = createForm(127, 136)
  email.focus()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(208)
  const rect = password.getBoundingClientRect()
  expect((rect.top + rect.bottom) / 2).toBe(255)
  expect(email.getBoundingClientRect().bottom).toBeLessThanOrEqual(255)
  password.focus()
  revealNativeInput(content, true)
  expect(password.getBoundingClientRect().bottom).toBeLessThanOrEqual(255)
  expect(document.activeElement).toBe(password)
})

test('a resized visual viewport bounds reveal without subtracting keyboard height twice', () => {
  const { content, email } = createForm()
  vi.stubGlobal('visualViewport', { offsetTop: 0, height: 471 })
  email.focus()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(83)
})

test('nonkeyboard focus does not reposition a visible field just to expose its neighbor', () => {
  const { content, email } = createForm()
  email.focus()
  revealNativeInput(content, false)
  expect(content.scrollTop).toBe(0)
})

test('portal, readonly and disabled fields cannot change the content scroll or focus', () => {
  const { content, email, password } = createForm()
  const outside = document.getElementById('outside')!
  outside.focus()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(0)
  expect(document.activeElement).toBe(outside)
  password.disabled = true
  email.focus()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(0)
  email.readOnly = true
  content.scrollTop = 200
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(200)
})

test('scroll stays clamped to the content extent', () => {
  const { content, password } = createForm()
  vi.mocked(password.getBoundingClientRect).mockImplementation(() => new DOMRect(24, 900, 354, 36))
  password.focus()
  revealNativeInput(content, true)
  expect(content.scrollTop).toBe(232)
})
