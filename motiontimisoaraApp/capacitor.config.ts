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
  ...(process.env.MOTION_ANDROID_DEMO === '1'
    ? { server: { url: 'https://motiontimisoara-demo.netlify.app', cleartext: false } }
    : {}),
}

export default config
