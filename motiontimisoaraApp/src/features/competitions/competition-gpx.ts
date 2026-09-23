export type GpxPoint = [latitude: number, longitude: number]

export type CompetitionGpx = {
  segments: GpxPoint[][]
  pointCount: number
  xml: string
}

export const maxCompetitionGpxBytes = 2 * 1024 * 1024
export const maxCompetitionGpxPoints = 20_000

function childrenNamed(element: Element, name: string): Element[] {
  return Array.from(element.children).filter((child) => child.localName === name)
}

function pointFromElement(element: Element): GpxPoint {
  const latitudeText = element.getAttribute('lat')?.trim()
  const longitudeText = element.getAttribute('lon')?.trim()
  const latitude = Number(latitudeText)
  const longitude = Number(longitudeText)

  if (
    !latitudeText ||
    !longitudeText ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Fișierul GPX conține coordonate invalide.')
  }

  return [latitude, longitude]
}

export function parseCompetitionGpx(xml: string): CompetitionGpx {
  if (new TextEncoder().encode(xml).byteLength > maxCompetitionGpxBytes) {
    throw new Error('Fișierul GPX depășește limita de 2 MB.')
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new Error('Fișierul GPX conține o declarație XML nepermisă.')
  }
  const pointTags = xml.match(/<(?:[\w.-]+:)?(?:trkpt|rtept)(?=[\s/>])/gi)
  if (pointTags && pointTags.length > maxCompetitionGpxPoints) {
    throw new Error('Traseul GPX are prea multe puncte pentru hartă.')
  }

  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (
    document.documentElement.localName !== 'gpx' ||
    document.getElementsByTagName('parsererror').length > 0
  ) {
    throw new Error('Fișierul GPX nu este valid.')
  }

  const segments: GpxPoint[][] = []
  let pointCount = 0

  function addSegment(elements: Element[]) {
    if (elements.length === 0) return
    pointCount += elements.length
    if (pointCount > maxCompetitionGpxPoints) {
      throw new Error('Traseul GPX are prea multe puncte pentru hartă.')
    }
    segments.push(elements.map(pointFromElement))
  }

  for (const track of childrenNamed(document.documentElement, 'trk')) {
    for (const segment of childrenNamed(track, 'trkseg')) {
      addSegment(childrenNamed(segment, 'trkpt'))
    }
  }
  for (const route of childrenNamed(document.documentElement, 'rte')) {
    addSegment(childrenNamed(route, 'rtept'))
  }

  if (pointCount === 0) {
    throw new Error('Fișierul GPX nu conține un traseu.')
  }

  return { segments, pointCount, xml }
}

export function publicCompetitionGpxUrl(value: string | null): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export async function loadCompetitionGpx(
  url: string,
  signal?: AbortSignal,
): Promise<CompetitionGpx> {
  const publicUrl = publicCompetitionGpxUrl(url)
  if (!publicUrl) throw new Error('Adresa fișierului GPX nu este validă.')

  const response = await fetch(publicUrl, { signal })
  if (!response.ok) throw new Error('Nu am putut descărca fișierul GPX.')

  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > maxCompetitionGpxBytes) {
      throw new Error('Fișierul GPX depășește limita de 2 MB.')
    }
    return parseCompetitionGpx(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
  }

  const decoder = new TextDecoder('utf-8', { fatal: true })
  let xml = ''
  let bytesRead = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      if (bytesRead > maxCompetitionGpxBytes) {
        await reader.cancel()
        throw new Error('Fișierul GPX depășește limita de 2 MB.')
      }
      xml += decoder.decode(value, { stream: true })
    }
    xml += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  return parseCompetitionGpx(xml)
}
