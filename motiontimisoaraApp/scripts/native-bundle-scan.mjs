import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FORBIDDEN = [
  {
    label: 'subscription wording',
    pattern:
      /abonea|abonează|(alege|gestionează|plătește|reînnoiește|activează|prelungește) abonamentul|abonamentul (tău|clubului|antrenorului)|abonament (activ|expirat|lunar)/i,
  },
  { label: 'pricing page route', pattern: /\/preturi\b|\/prețuri\b/i },
  { label: 'subscription price per month', pattern: /lei\s*\/\s*lun/i },
  { label: 'subscription plan code or name', pattern: /CLUB_START|CLUB_PRO|Club Start|Club Pro/ },
  { label: 'subscription plans table', pattern: /subscription_plans/ },
  { label: 'subscription checkout function', pattern: /create-subscription-checkout/ },
  { label: 'billing portal', pattern: /billing-portal|billingPortal|billing\.stripe\.com/ },
]

export function findForbidden(text) {
  return FORBIDDEN.flatMap(({ label, pattern }) => {
    const match = pattern.exec(text)
    if (!match) return []
    const start = Math.max(0, match.index - 40)
    const excerpt = text.slice(start, match.index + match[0].length + 40).replace(/\s+/g, ' ')
    return [{ label, match: match[0], excerpt }]
  })
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return listFiles(path)
    return /\.(js|mjs|html|json|webmanifest|txt)$/.test(name) ? [path] : []
  })
}

export function scanDirectory(dir) {
  return listFiles(dir).flatMap((file) =>
    findForbidden(readFileSync(file, 'utf8')).map((hit) => ({ file: relative(dir, file), ...hit })),
  )
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const dir = resolve(process.argv[2] ?? 'dist')
  const hits = scanDirectory(dir)
  if (hits.length > 0) {
    console.error('[native-bundle-scan] The native bundle must not sell subscriptions:')
    for (const hit of hits)
      console.error(`  ${hit.file}: ${hit.label} "${hit.match}" … ${hit.excerpt}`)
    process.exit(1)
  }
  console.log(
    `[native-bundle-scan] ${dir}: no subscription prices, plans, routes or payment links.`,
  )
}
