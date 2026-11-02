import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'motiontimisoaraApp')
const res = join(app, 'android', 'app', 'src', 'main', 'res')
const ios = join(app, 'ios', 'App', 'App', 'Assets.xcassets')

const PATH = 'M3 17 L8 7 L12 13 L16 5 L21 17'
const GRADIENT = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient>'

function glyph(x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${PATH}" transform="translate(0 1)" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${GRADIENT}</defs>${body}</svg>`
}

function plate(x, y, size, radius) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>${glyph(x + size * 0.2, y + size * 0.2, size * 0.6)}`
}

const square = (s) => svg(s, s, plate(0, 0, s, 0))
const rounded = (s) => svg(s, s, plate(0, 0, s, s * 0.22))
const round = (s) => svg(s, s, `<clipPath id="c"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></clipPath><g clip-path="url(#c)">${plate(0, 0, s, 0)}</g>`)
const background = (s) => svg(s, s, `<rect width="${s}" height="${s}" fill="url(#g)"/>`)
const foreground = (s) => svg(s, s, glyph(s * 0.3, s * 0.3, s * 0.4))
const splash = (w, h) => {
  const size = Math.round(Math.min(w, h) * 0.22)
  return svg(w, h, `<rect width="${w}" height="${h}" fill="#ffffff"/>${plate((w - size) / 2, (h - size) / 2, size, size * 0.22)}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()

async function render(file, w, h, markup) {
  await mkdir(dirname(file), { recursive: true })
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`)
  await page.locator('svg').first().screenshot({ path: file, omitBackground: true })
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [name, scale] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${name}`)
  const legacy = 48 * scale
  const layer = 108 * scale
  await render(join(dir, 'ic_launcher.png'), legacy, legacy, rounded(legacy))
  await render(join(dir, 'ic_launcher_round.png'), legacy, legacy, round(legacy))
  await render(join(dir, 'ic_launcher_foreground.png'), layer, layer, foreground(layer))
  await render(join(dir, 'ic_launcher_background.png'), layer, layer, background(layer))
}

for (const dir of (await readdir(res)).filter((d) => d.startsWith('drawable'))) {
  const file = join(res, dir, 'splash.png')
  if (!existsSync(file)) continue
  const header = await readFile(file)
  const w = header.readUInt32BE(16)
  const h = header.readUInt32BE(20)
  await render(file, w, h, splash(w, h))
}

await render(join(ios, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), 1024, 1024, square(1024))
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await render(join(ios, 'Splash.imageset', name), 2732, 2732, splash(2732, 2732))
}

await render(join(app, 'public', 'apple-touch-icon.png'), 180, 180, square(180))
await render(join(app, 'public', 'favicon-32.png'), 32, 32, rounded(32))
await render(join(app, 'resources', 'store', 'play-icon-512.png'), 512, 512, square(512))
await writeFile(join(app, 'public', 'favicon.svg'), `${rounded(64)}\n`)

await browser.close()
