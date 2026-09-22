import { z } from 'zod'
import { competitionScheduleFromFields } from '@/lib/competition-schedule'

export const competitionFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Titlul este obligatoriu.').max(120, 'Titlul este prea lung.'),
    description: z
      .string()
      .trim()
      .min(1, 'Descrierea este obligatorie.')
      .max(4000, 'Descrierea este prea lungă.'),
    startDate: z.string().min(1, 'Alege data de început.'),
    startTime: z.string().min(1, 'Alege ora de început.'),
    endDate: z.string().min(1, 'Alege data de final.'),
    endTime: z.string().min(1, 'Alege ora de final.'),
    registrationDeadlineDate: z.string().min(1, 'Alege ultima zi de înscriere.'),
    registrationDeadlineTime: z.string().min(1, 'Alege ora de închidere a înscrierilor.'),
    locationId: z.string(),
    locationText: z
      .string()
      .trim()
      .min(1, 'Locația este obligatorie.')
      .max(200, 'Locația este prea lungă.'),
    allowCash: z.boolean(),
  })
  .superRefine((values, context) => {
    if (
      !values.startDate ||
      !values.startTime ||
      !values.endDate ||
      !values.endTime ||
      !values.registrationDeadlineDate ||
      !values.registrationDeadlineTime
    ) {
      return
    }
    try {
      competitionScheduleFromFields(values)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Datele concursului nu sunt valide.'
      const path = message.startsWith('Sfârșitul')
        ? ['endDate']
        : message.startsWith('Înscrierile')
          ? ['registrationDeadlineDate']
          : ['startDate']
      context.addIssue({ code: 'custom', message, path })
    }
  })

export type CompetitionFormValues = z.infer<typeof competitionFormSchema>

export const competitionFormDefaults: CompetitionFormValues = {
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  registrationDeadlineDate: '',
  registrationDeadlineTime: '',
  locationId: '',
  locationText: '',
  allowCash: false,
}
