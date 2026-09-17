export type ComponentaPretVarsta = { name: string; amount: number }

export function citesteComponentePret(value: unknown): ComponentaPretVarsta[] {
  if (!Array.isArray(value)) return []
  const componente: ComponentaPretVarsta[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as { name?: unknown; amount?: unknown }
    const name = typeof rec.name === 'string' ? rec.name.trim() : ''
    const amount = typeof rec.amount === 'number' ? rec.amount : Number(rec.amount)
    if (!name || !Number.isSafeInteger(amount) || amount < 0) continue
    componente.push({ name, amount })
  }
  return componente
}
