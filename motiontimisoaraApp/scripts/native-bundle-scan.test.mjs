import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findForbidden, scanDirectory } from './native-bundle-scan.mjs'

const dirs = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('native bundle scan', () => {
  it.each([
    ['Abonamentul tău expiră', 'subscription wording'],
    ['Alege abonamentul', 'subscription wording'],
    ['Gestionează abonamentul', 'subscription wording'],
    ['Abonează-te acum', 'subscription wording'],
    ['{path:"/preturi",element:x}', 'pricing page route'],
    ['100 lei/lună', 'subscription price per month'],
    ['"CLUB_START"', 'subscription plan code or name'],
    ['from("subscription_plans")', 'subscription plans table'],
    ['functions.invoke("create-subscription-checkout")', 'subscription checkout function'],
    ['invoke("billing-portal")', 'billing portal'],
    ['invoke("change-subscription-plan")', 'subscription plan change function'],
  ])('flags %s', (text, label) => {
    expect(findForbidden(text).map((hit) => hit.label)).toContain(label)
  })

  it.each([
    'Profilul tău nu apare acum în căutare.',
    'Plătești la înscriere un pachet de ședințe, online sau cash.',
    'Buget pe lună',
    'create-payment-intent',
    'https://js.stripe.com/v3',
    'https://checkout.stripe.com/c/pay',
    'Copilul nu mai are ședințe disponibile. Verifică abonamentul.',
  ])('allows parent payments and neutral text: %s', (text) => {
    expect(findForbidden(text)).toEqual([])
  })

  it('reports the file of every hit in a built directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'native-scan-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'assets', 'ok.js'), 'console.log("Cursuri")')
    writeFileSync(join(dir, 'assets', 'bad.js'), 'const p="/preturi"')
    writeFileSync(join(dir, 'assets', 'image.png'), '/preturi')
    expect(scanDirectory(dir)).toEqual([
      expect.objectContaining({ file: join('assets', 'bad.js'), label: 'pricing page route' }),
    ])
  })
})
