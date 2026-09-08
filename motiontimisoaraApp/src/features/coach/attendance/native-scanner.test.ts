import { beforeEach, expect, it, vi } from 'vitest'
import { scanAttendanceCode } from './native-scanner'

const { scan, native } = vi.hoisted(() => ({ scan: vi.fn(), native: vi.fn(() => true) }))
vi.mock('@/lib/platform', () => ({ isNative: native }))
vi.mock('@capacitor/barcode-scanner', () => ({
  CapacitorBarcodeScanner: { scanBarcode: scan },
  CapacitorBarcodeScannerTypeHint: { QR_CODE: 0 },
  CapacitorBarcodeScannerAndroidScanningLibrary: { ZXING: 'zxing' },
}))
beforeEach(() => {
  vi.clearAllMocks()
  native.mockReturnValue(true)
})

it('returns only a valid child token with the offline decoder and session instructions', async () => {
  scan.mockResolvedValue({ ScanResult: `MT1:${'a'.repeat(32)}` })
  expect(await scanAttendanceCode('Înot · 8 septembrie')).toBe('a'.repeat(32))
  expect(scan).toHaveBeenCalledWith(
    expect.objectContaining({
      hint: 0,
      android: { scanningLibrary: 'zxing' },
      scanInstructions: expect.stringContaining('Înot · 8 septembrie'),
    }),
  )
})
it('cancellation is silent and a denied permission explains the manual fallback', async () => {
  scan.mockRejectedValueOnce({ message: 'The process was cancelled.' })
  expect(await scanAttendanceCode('Înot')).toBeNull()
  scan.mockRejectedValueOnce({ message: 'Camera permission denied' })
  await expect(scanAttendanceCode('Înot')).rejects.toThrow('catalogul manual')
})
it('rejects arbitrary QR links and does not open a browser camera', async () => {
  scan.mockResolvedValue({ ScanResult: 'https://example.test/child' })
  await expect(scanAttendanceCode('Înot')).rejects.toThrow('nu este un cod QR Motion valid')
  native.mockReturnValue(false)
  scan.mockClear()
  await expect(scanAttendanceCode('Înot')).rejects.toThrow('aplicația de pe telefon')
  expect(scan).not.toHaveBeenCalled()
})
