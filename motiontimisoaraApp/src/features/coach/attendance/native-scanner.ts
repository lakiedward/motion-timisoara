import { isNative } from '@/lib/platform'
import { tokenDinCod } from '@/lib/cod-qr'

export async function scanAttendanceCode(label: string): Promise<string | null> {
  if (!isNative()) throw new Error('Scanarea este disponibilă în aplicația de pe telefon.')
  const {
    CapacitorBarcodeScanner,
    CapacitorBarcodeScannerTypeHint,
    CapacitorBarcodeScannerAndroidScanningLibrary,
  } = await import('@capacitor/barcode-scanner')
  try {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: `${label}\nÎncadrează codul QR al copilului`,
      scanButton: false,
      cancelButtonAccessibilityLabel: 'Anulează scanarea',
      torchButtonOnAccessibilityLabel: 'Stinge lanterna',
      torchButtonOffAccessibilityLabel: 'Aprinde lanterna',
      android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.ZXING },
    })
    const token = tokenDinCod(result.ScanResult)
    if (!token) throw new Error('Acesta nu este un cod QR Motion valid. Cere codul copilului.')
    return token
  } catch (error) {
    const detail = error as { code?: string; message?: string }
    if (/cancel/i.test(detail.message ?? '')) return null
    if (/permission|access.*denied|access.*provided/i.test(detail.message ?? '')) {
      throw new Error(
        'Permite accesul la cameră din setările telefonului pentru a scana. Poți folosi și catalogul manual.',
        { cause: error },
      )
    }
    if (error instanceof Error && error.message.startsWith('Acesta')) throw error
    throw new Error('Camera nu a putut fi deschisă. Reîncearcă sau folosește catalogul manual.', {
      cause: error,
    })
  }
}
