export type CampRequirementItem = {
  name: string
  quantity: number
}

export type CampRequirementCategory = {
  name: string
  items: CampRequirementItem[]
}

type CampRequirementFormCategory = {
  name: string
  items: { name: string; quantity: string }[]
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim()
}

function quantity(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null
  return value
}

export function readCampRequirements(value: unknown): CampRequirementCategory[] {
  if (!Array.isArray(value)) return []
  const legacyItems = value
    .map((item) => text(item))
    .filter((item): item is string => item !== null)
    .map((name) => ({ name, quantity: 1 }))
  if (legacyItems.length > 0) return [{ name: 'Necesar pentru tabără', items: legacyItems }]

  return value
    .map((category) => {
      if (!category || typeof category !== 'object' || Array.isArray(category)) return null
      const name = text((category as { name?: unknown }).name)
      const itemsValue = (category as { items?: unknown }).items
      if (!name || !Array.isArray(itemsValue)) return null
      const items = itemsValue
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const itemName = text((item as { name?: unknown }).name)
          const itemQuantity = quantity((item as { quantity?: unknown }).quantity)
          return itemName && itemQuantity ? { name: itemName, quantity: itemQuantity } : null
        })
        .filter((item): item is CampRequirementItem => item !== null)
      return items.length > 0 ? { name, items } : null
    })
    .filter((category): category is CampRequirementCategory => category !== null)
}

export function campRequirementsForSave(
  categories: CampRequirementFormCategory[],
): CampRequirementCategory[] {
  return categories.map((category) => ({
    name: category.name.trim(),
    items: category.items.map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity),
    })),
  }))
}
