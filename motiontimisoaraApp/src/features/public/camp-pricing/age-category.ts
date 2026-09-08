export function ageAtCampStart(birthDate: string, startDate: string): number | null {
  const calendarParts = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(`${value}T00:00:00Z`)
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
      ? { year, month, day }
      : null
  }
  const birth = calendarParts(birthDate)
  const start = calendarParts(startDate)
  if (!birth || !start || birthDate > startDate) return null
  const beforeBirthday = start.month < birth.month || (start.month === birth.month && start.day < birth.day)
  return start.year - birth.year - Number(beforeBirthday)
}

export function matchesAgeCategory(age: number | null, category: { age_from: number; age_to: number }) {
  return age !== null && age >= category.age_from && age <= category.age_to
}
