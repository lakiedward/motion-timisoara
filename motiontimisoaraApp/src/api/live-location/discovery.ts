import { z } from 'zod'
import { locationAccessToken, LocationError, sendLocationPayload } from './transport'

const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)))
const sessionSchema = z
  .object({
    sessionId: z.string().uuid(),
    campId: z.string().uuid().nullable(),
    occurrenceId: z.string().uuid().nullable(),
    coachId: z.string().uuid(),
    coachName: z.string(),
    title: z.string(),
    expiresAt: timestamp,
  })
  .refine((value) => (value.campId === null) !== (value.occurrenceId === null))

const participantSchema = z.object({
  enrollmentId: z.string().uuid(),
  childName: z.string(),
  arrivedAt: timestamp.nullable(),
  departedAt: timestamp.nullable(),
})

const participantsSchema = z.object({
  participants: z.array(participantSchema),
  startsAt: timestamp,
  endsAt: timestamp,
  canShare: z.boolean(),
})

export type ActiveLocationSession = z.infer<typeof sessionSchema>
export type CampParticipant = z.infer<typeof participantSchema>

async function command(body: object, actorId: string) {
  const result = await sendLocationPayload(body, await locationAccessToken(actorId))
  await locationAccessToken(actorId)
  return result
}

export async function getActiveLocationSessions(actorId: string): Promise<ActiveLocationSession[]> {
  const data = await command({ action: 'list' }, actorId)
  const result = z.array(sessionSchema).safeParse(data.sessions)
  if (!result.success)
    throw new LocationError('INVALID_RESPONSE', 'Nu am putut verifica partajările active.')
  return result.data
}

export async function getCampParticipants(campId: string, actorId: string) {
  const data = await command({ action: 'participants', campId }, actorId)
  const result = participantsSchema.safeParse(data)
  if (!result.success)
    throw new LocationError('INVALID_RESPONSE', 'Nu am putut verifica prezența în tabără.')
  return result.data
}

export async function recordCampParticipation(
  action: 'arrive' | 'depart',
  campId: string,
  enrollmentId: string,
  actorId: string,
) {
  await command({ action, campId, enrollmentId }, actorId)
}
