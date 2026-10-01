import { beforeEach, expect, test, vi } from 'vitest'
import { Keyboard } from '@capacitor/keyboard'
import { platform } from '@/lib/platform'
import { initializeNativeKeyboard, setNativeDocumentScroll } from './native-keyboard'

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    setAccessoryBarVisible: vi.fn().mockResolvedValue(undefined),
    setScroll: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@/lib/platform', () => ({ platform: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

test('iOS startup waits for visible accessory arrows and Done before becoming ready', async () => {
  vi.mocked(platform).mockReturnValue('ios')
  let restoreAccessory!: () => void
  vi.mocked(Keyboard.setAccessoryBarVisible).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        restoreAccessory = resolve
      }),
  )
  const ready = vi.fn()
  const startup = initializeNativeKeyboard().then(ready)
  await Promise.resolve()
  expect(Keyboard.setAccessoryBarVisible).toHaveBeenCalledWith({ isVisible: true })
  expect(ready).not.toHaveBeenCalled()
  restoreAccessory()
  await startup
  expect(ready).toHaveBeenCalledOnce()
})

test.each(['web', 'android'] as const)('%s skips iOS keyboard controls', async (target) => {
  vi.mocked(platform).mockReturnValue(target)
  await initializeNativeKeyboard()
  await setNativeDocumentScroll(true)
  expect(Keyboard.setAccessoryBarVisible).not.toHaveBeenCalled()
  expect(Keyboard.setScroll).not.toHaveBeenCalled()
})

test('iOS document scrolling can be disabled and restored', async () => {
  vi.mocked(platform).mockReturnValue('ios')
  await setNativeDocumentScroll(true)
  await setNativeDocumentScroll(false)
  expect(Keyboard.setScroll).toHaveBeenNthCalledWith(1, { isDisabled: true })
  expect(Keyboard.setScroll).toHaveBeenNthCalledWith(2, { isDisabled: false })
})
