export function campLocationKey(campId: string, coachId: string) {
  return `camp:${campId}:${coachId}`
}

export function locationTarget(key: string) {
  if (!key.startsWith('camp:')) return { occurrenceId: key }
  const [, campId, coachId, extra] = key.split(':')
  if (!campId || !coachId || extra !== undefined) throw new Error('Partajarea nu este validă.')
  return { campId, coachId }
}
