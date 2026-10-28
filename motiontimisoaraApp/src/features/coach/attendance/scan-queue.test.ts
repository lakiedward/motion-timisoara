import { describe, expect, it } from 'vitest'
import { formatScanTime, groupScans, scanCounts, waitingText } from './scan-queue'
import type { ScanEntry } from './attendance-queue'

const scan = (occurrenceId: string, capturedAt: string, state: ScanEntry['state']): ScanEntry => ({
  id: `${occurrenceId}-${capturedAt}`,
  occurrenceId,
  label: occurrenceId,
  capturedAt,
  state,
  message: '',
  ...(state === 'confirmed' ? {} : { token: 'a'.repeat(32) }),
})

describe('offline scan queue grouping', () => {
  it('puts sessions with waiting scans first and newest scans on top', () => {
    const groups = groupScans([
      scan('rejected-only', '2026-10-20T15:00:00.000Z', 'rejected'),
      scan('waiting', '2026-10-20T10:00:00.000Z', 'pending'),
      scan('waiting', '2026-10-20T11:00:00.000Z', 'confirmed'),
    ])
    expect(groups.map((group) => group.occurrenceId)).toEqual(['waiting', 'rejected-only'])
    expect(groups[0]).toMatchObject({ pending: 1, rejected: 0 })
    expect(groups[0].entries[0].state).toBe('confirmed')
  })

  it('shows only counts above zero', () => {
    expect(scanCounts(0, 0)).toEqual([])
    expect(scanCounts(3, 0)).toEqual(['3 în așteptare'])
    expect(scanCounts(0, 2)).toEqual(['2 de verificat'])
  })

  it('uses Romanian number agreement in the offline message', () => {
    expect(waitingText(1)).toContain('1 scanare este păstrată')
    expect(waitingText(5)).toContain('5 scanări sunt păstrate')
    expect(waitingText(24)).toContain('24 de scanări sunt păstrate')
  })

  it('adds the day only for scans from another day', () => {
    const now = new Date('2026-10-20T18:00:00+03:00')
    expect(formatScanTime('2026-10-20T14:05:00Z', now)).toBe('la 17:05')
    expect(formatScanTime('2026-10-19T06:30:00Z', now)).toBe(
      'pe 19.10 la 09:30',
    )
  })
})
