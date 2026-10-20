import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'com.motiontimisoara.app',
  appName: 'Motion Timisoara',
  webDir: 'dist',
  android: { useLegacyBridge: true, loggingBehavior: 'none' },
  plugins: {
    CapacitorHttp: { enabled: true },
    Keyboard: { resize: KeyboardResize.Native },
  },
}

export default config
