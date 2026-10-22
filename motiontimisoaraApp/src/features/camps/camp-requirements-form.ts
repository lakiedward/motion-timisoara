type ArticolFormular = { name?: string; quantity?: string } | undefined

export function categorieNecesarNoua() {
  return { name: '', items: [{ name: '', quantity: '1' }] }
}

export function articoleCompletate(items: ArticolFormular[] | undefined): number {
  return (items ?? []).filter((item) => !!item?.name?.trim()).length
}

export function etichetaArticole(numar: number): string {
  if (numar === 1) return '1 articol'
  if (numar === 0 || numar % 100 < 20) return `${numar} articole`
  return `${numar} de articole`
}
