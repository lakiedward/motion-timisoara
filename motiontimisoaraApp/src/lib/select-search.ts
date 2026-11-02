export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('ro').trim()
}

export function matchesSearch(label: string, query: string): boolean {
  const needle = normalizeSearchText(query)
  if (!needle) return true
  return normalizeSearchText(label).includes(needle)
}

export function filterBySearch<T extends { label: string }>(items: T[], query: string): T[] {
  if (!normalizeSearchText(query)) return items
  return items.filter((item) => matchesSearch(item.label, query))
}
