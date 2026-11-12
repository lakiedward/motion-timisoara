export const POSTER_STEPS = [
  'Scanează codul cu camera telefonului.',
  'Intră în contul de părinte Motion România.',
  'Alege copilul și apasă „Marchează prezent”.',
]

export const POSTER_WINDOW =
  'Prezența se marchează de la 15 minute înainte de ședință până la final.'

const PAGE_CSS = `
@page { size: A4 portrait; margin: 16mm; }
* { box-sizing: border-box; }
html, body { margin: 0; color: #000; background: #fff; }
body { font-family: 'Manrope Variable', 'Inter Variable', system-ui, sans-serif; }
.poster { min-height: calc(297mm - 32mm); display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; gap: 8mm; }
h1 { font-size: 34pt; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
.coach { font-size: 18pt; margin: 3mm 0 0; }
img { width: 140mm; height: 140mm; image-rendering: pixelated; }
ol { font-size: 15pt; text-align: left; margin: 0; padding-left: 8mm; line-height: 1.6; }
.window { font-size: 13pt; margin: 4mm 0 0; }
.brand { font-size: 12pt; font-weight: 700; margin: 0; }
`

export function printEntrancePoster(image: string, coachName: string): boolean {
  const popup = window.open('', '_blank', 'width=800,height=1000')
  if (!popup) return false
  const doc = popup.document
  doc.title = `Cod de prezență — ${coachName}`
  const style = doc.createElement('style')
  style.textContent = PAGE_CSS
  doc.head.append(style)

  const poster = doc.createElement('main')
  poster.className = 'poster'
  const header = doc.createElement('div')
  const title = doc.createElement('h1')
  title.textContent = 'Prezența la curs'
  const coach = doc.createElement('p')
  coach.className = 'coach'
  coach.textContent = `Antrenor: ${coachName}`
  header.append(title, coach)

  const img = doc.createElement('img')
  img.src = image
  img.alt = ''

  const help = doc.createElement('div')
  const steps = doc.createElement('ol')
  for (const step of POSTER_STEPS) {
    const item = doc.createElement('li')
    item.textContent = step
    steps.append(item)
  }
  const window_ = doc.createElement('p')
  window_.className = 'window'
  window_.textContent = POSTER_WINDOW
  help.append(steps, window_)

  const brand = doc.createElement('p')
  brand.className = 'brand'
  brand.textContent = 'Motion România'

  poster.append(header, img, help, brand)
  doc.body.append(poster)
  popup.focus()
  const print = () => popup.print()
  if (img.complete) print()
  else img.addEventListener('load', print, { once: true })
  return true
}
