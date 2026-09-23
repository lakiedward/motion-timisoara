import { vi } from 'vitest'
import {
  loadCompetitionGpx,
  maxCompetitionGpxBytes,
  maxCompetitionGpxPoints,
  parseCompetitionGpx,
  publicCompetitionGpxUrl,
} from './competition-gpx'

const validGpx = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk><trkseg><trkpt lat="45.75" lon="21.22"/><trkpt lat="45.76" lon="21.23"/></trkseg>
  <trkseg><trkpt lat="45.77" lon="21.24"/></trkseg></trk>
  <rte><rtept lat="46" lon="22"/><rtept lat="47" lon="23"/></rte>
</gpx>`

afterEach(() => vi.unstubAllGlobals())

test('preserves GPX track segments and route points as separate map lines', () => {
  const parsed = parseCompetitionGpx(validGpx)
  expect(parsed.segments).toEqual([
    [
      [45.75, 21.22],
      [45.76, 21.23],
    ],
    [[45.77, 21.24]],
    [
      [46, 22],
      [47, 23],
    ],
  ])
  expect(parsed.pointCount).toBe(5)
})

test.each([
  '<gpx><trk><trkseg><trkpt lat="91" lon="21"/></trkseg></trk></gpx>',
  '<gpx><rte><rtept lat="45" lon="-181"/></rte></gpx>',
  '<gpx><rte><rtept lat="NaN" lon="21"/></rte></gpx>',
  '<gpx><rte><rtept lat="" lon="21"/></rte></gpx>',
])('rejects invalid coordinates', (xml) => {
  expect(() => parseCompetitionGpx(xml)).toThrow('coordonate invalide')
})

test.each([
  '<gpx><trk><trkseg><trkpt lat="45" lon="21"></trkseg></trk></gpx>',
  '<not-gpx><rte><rtept lat="45" lon="21"/></rte></not-gpx>',
])('rejects malformed or non-GPX XML', (xml) => {
  expect(() => parseCompetitionGpx(xml)).toThrow('nu este valid')
})

test('rejects empty geometry and unsafe XML declarations', () => {
  expect(() => parseCompetitionGpx('<gpx><trk><trkseg/></trk></gpx>')).toThrow(
    'nu conține un traseu',
  )
  expect(() => parseCompetitionGpx('<!DOCTYPE gpx><gpx/>')).toThrow('nepermisă')
})

test('bounds geometry before rendering', () => {
  const points = '<rtept lat="45" lon="21"/>'.repeat(maxCompetitionGpxPoints + 1)
  expect(() => parseCompetitionGpx(`<gpx><rte>${points}</rte></gpx>`)).toThrow('prea multe puncte')
  expect(() => parseCompetitionGpx(`<gpx>${' '.repeat(maxCompetitionGpxBytes)}</gpx>`)).toThrow(
    'limita de 12 MB',
  )
})

test('keeps the original GPX and endpoints while limiting map geometry', () => {
  const middle = '<trkpt lat="45.5" lon="21.5"/>'.repeat(8)
  const xml = `<gpx><trk><trkseg><trkpt lat="45" lon="21"/>${middle}<trkpt lat="46" lon="22"/></trkseg></trk></gpx>`
  const parsed = parseCompetitionGpx(xml, 6)
  expect(parsed.pointCount).toBe(10)
  expect(parsed.segments[0]).toHaveLength(6)
  expect(parsed.segments[0][0]).toEqual([45, 21])
  expect(parsed.segments[0].at(-1)).toEqual([46, 22])
  expect(parsed.xml).toBe(xml)
})

test('loads a public GPX response and blocks unsafe URLs', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(validGpx, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  expect(publicCompetitionGpxUrl('javascript:alert(1)')).toBeNull()
  await expect(loadCompetitionGpx('javascript:alert(1)')).rejects.toThrow('nu este validă')
  const gpx = await loadCompetitionGpx('https://example.test/route.gpx')
  expect(gpx.pointCount).toBe(5)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('stops reading a response as soon as it exceeds the 12 MiB limit', async () => {
  const response = new Response(new Uint8Array(maxCompetitionGpxBytes + 1), { status: 200 })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  await expect(loadCompetitionGpx('https://example.test/oversized.gpx')).rejects.toThrow(
    'limita de 12 MB',
  )
})
