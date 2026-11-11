export type CameraProblem = 'permission' | 'no-camera' | 'unsupported' | 'busy' | 'unknown'

export interface CameraSession {
  stop: () => Promise<void>
}

export const cameraProblemText: Record<CameraProblem, { title: string; text: string }> = {
  permission: {
    title: 'Camera nu are permisiune',
    text: 'Permite accesul la cameră din setările browserului, apoi reîncearcă. Poți ponta și din catalogul manual.',
  },
  'no-camera': {
    title: 'Dispozitivul nu are cameră',
    text: 'Nu am găsit nicio cameră pe acest dispozitiv. Folosește catalogul manual sau scanează de pe telefon.',
  },
  unsupported: {
    title: 'Browserul nu permite camera',
    text: 'Deschide site-ul într-un browser actual (Chrome, Safari, Edge sau Firefox) ori folosește catalogul manual.',
  },
  busy: {
    title: 'Camera este folosită de altă aplicație',
    text: 'Închide aplicația care folosește camera, apoi reîncearcă. Poți ponta și din catalogul manual.',
  },
  unknown: {
    title: 'Camera nu a putut fi deschisă',
    text: 'Reîncearcă sau folosește catalogul manual.',
  },
}

export function cameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

export function classifyCameraError(error: unknown): CameraProblem {
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  const detail = `${name} ${error instanceof Error ? error.message : String(error)}`
  if (/NotAllowed|Permission|SecurityError/i.test(detail)) return 'permission'
  if (/NotFound|DevicesNotFound|Overconstrained|Requested device not found/i.test(detail)) {
    return 'no-camera'
  }
  if (/NotReadable|TrackStart|Could not start video source/i.test(detail)) return 'busy'
  if (/NotSupported|not supported|getUserMedia is not/i.test(detail)) return 'unsupported'
  return 'unknown'
}

export async function startWebCamera(
  elementId: string,
  onText: (text: string) => void,
): Promise<CameraSession> {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
  const reader = new Html5Qrcode(elementId, {
    verbose: false,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    useBarCodeDetectorIfSupported: true,
  })
  await reader.start({ facingMode: 'environment' }, { fps: 10 }, onText, undefined)
  return {
    stop: async () => {
      if (reader.isScanning) await reader.stop()
      reader.clear()
    },
  }
}
