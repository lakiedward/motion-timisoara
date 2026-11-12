import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const delta = JSON.parse(readFileSync(join(here, 'delta-qr-amprente-2026-11-12.json'), 'utf8'))
const unknownArgs = process.argv.slice(2).filter((a) => a !== '--proba')
if (unknownArgs.length) { console.log(`Argument necunoscut: ${unknownArgs.join(' ')}. Nu am scris nimic.`); process.exit(4) }
const dryRun = process.argv.includes('--proba')
const onlyNoVerdict = false
const ALLOWED = [4676, 4677, 4678, 501, 521, 3339, 530, 552, 452, 3328, 485, 496, 255, 222]
if (delta.surfaces.length !== ALLOWED.length || new Set(delta.surfaces.map((s) => s.id)).size !== ALLOWED.length || delta.surfaces.some((s) => !ALLOWED.includes(s.id))) { console.log('Fișierul delta are alte suprafețe decât cele 14 așteptate. Nu am scris nimic.'); process.exit(5) }
const base = 'https://ntjzghsbrzkvpkniotaj.supabase.co/rest/v1/tt_ui_surfaces'

const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY lipsește din mediu')
let ref = null
try { ref = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).ref } catch { ref = null }
if (ref !== 'ntjzghsbrzkvpkniotaj') throw new Error('cheia din SUPABASE_SERVICE_ROLE_KEY nu e cheia Team Tracker')
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }

async function call(url, method = 'GET', body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const surfaces = delta.surfaces
  .filter((s) => !onlyNoVerdict || s.verdict_effect === 'no_verdict')
  .sort((a, b) => (a.kind === 'page' ? 0 : 1) - (b.kind === 'page' ? 0 : 1) || a.id - b.id)
console.log(`Mod: ${dryRun ? 'PROBĂ' : 'SCRIERE'}, ${onlyNoVerdict ? 'doar fără verdict' : 'toate'}: ${surfaces.length} suprafețe`)
const ids = surfaces.map((s) => s.id)
const current = new Map()
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100)
  for (const r of await call(`${base}?project_id=eq.16&id=in.(${chunk.join(',')})&select=id,updated_at,inventory_fingerprint,code_refs,inventory_state`)) current.set(r.id, r)
}

const conflicts = []
let pending = 0
for (const s of surfaces) {
  const r = current.get(s.id)
  if (!r) { conflicts.push({ id: s.id, why: 'rând lipsă' }); continue }
  if (r.inventory_fingerprint === s.new_fp && same(r.code_refs, s.code_refs)) continue
  if (r.inventory_state !== 'active') conflicts.push({ id: s.id, why: `stare ${r.inventory_state}` })
  else if (r.inventory_fingerprint !== s.old_fp || !same(r.code_refs, s.old_code_refs)) conflicts.push({ id: s.id, why: 'amprenta sau fișierele s-au schimbat după calcul' })
  else pending += 1
}
if (conflicts.length) {
  console.log(JSON.stringify({ ok: false, conflicts }, null, 1))
  process.exit(2)
}
if (dryRun) {
  console.log(JSON.stringify({ ok: true, proba: true, master: delta.master_sha, selectate: surfaces.length, de_scris: pending, deja_scrise: surfaces.length - pending, fara_verdict_doar: onlyNoVerdict }))
  process.exit(0)
}

const now = new Date().toISOString()
const written = []
for (const s of surfaces) {
  const latest = (await call(`${base}?project_id=eq.16&id=eq.${s.id}&select=updated_at,inventory_fingerprint,code_refs`))[0]
  if (latest.inventory_fingerprint === s.new_fp && same(latest.code_refs, s.code_refs)) { written.push({ id: s.id, rows: 0, note: 'deja scris' }); continue }
  const body = { code_refs: s.code_refs, inventory_fingerprint: s.new_fp, last_seen_at: now }
  if (s.codebase_label) body.codebase_label = s.codebase_label
  const rows = await call(`${base}?id=eq.${s.id}&project_id=eq.16&updated_at=eq.${encodeURIComponent(latest.updated_at)}`, 'PATCH', body)
  written.push({ id: s.id, rows: rows.length })
}

const check = new Map()
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100)
  for (const r of await call(`${base}?project_id=eq.16&id=in.(${chunk.join(',')})&select=id,inventory_fingerprint,code_refs`)) check.set(r.id, r)
}
const failed = surfaces.filter((s) => check.get(s.id)?.inventory_fingerprint !== s.new_fp || !same(check.get(s.id)?.code_refs, s.code_refs)).map((s) => s.id)
const report = { ok: failed.length === 0, at: now, master: delta.master_sha, scrise: written.filter((w) => w.rows === 1).length, deja_scrise: written.filter((w) => w.rows === 0).length, failed, written }
writeFileSync(join(here, 'rezultat-delta-qr.json'), JSON.stringify(report, null, 1))
console.log(JSON.stringify({ ok: report.ok, scrise: report.scrise, deja_scrise: report.deja_scrise, esuate: failed.length }))
process.exit(report.ok ? 0 : 3)
