import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.motiontimisoara.app',
  appName: 'Motion Timisoara',
  webDir: 'dist',
  android: { useLegacyBridge: true },
  plugins: { CapacitorHttp: { enabled: true } },
}

export default config
