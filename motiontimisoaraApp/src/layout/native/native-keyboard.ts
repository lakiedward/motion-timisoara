import { Keyboard } from '@capacitor/keyboard'
import { platform } from '@/lib/platform'

export async function initializeNativeKeyboard() {
  if (platform() === 'ios') {
    await Keyboard.setAccessoryBarVisible({ isVisible: true })
  }
}

export async function setNativeDocumentScroll(isDisabled: boolean) {
  if (platform() === 'ios') {
    await Keyboard.setScroll({ isDisabled })
  }
}
