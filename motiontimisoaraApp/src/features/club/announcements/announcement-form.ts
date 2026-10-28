import { z } from 'zod'

import { EMPTY_SCHEDULE, scheduleIssues, type ScheduleFields } from './announcement-schedule'
import { selectClassName } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'

export const announcementSelectClassName = cn(selectClassName, 'md:text-base')

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Scăzută' },
  { value: 'NORMAL', label: 'Normală' },
  { value: 'HIGH', label: 'Ridicată' },
  { value: 'URGENT', label: 'Urgentă' },
] as const

export const announcementTextSchema = z.object({
  title: z.string().trim().min(2, 'Scrie un titlu de cel puțin 2 caractere'),
  content: z.string().trim().min(2, 'Scrie conținutul anunțului'),
  priority: z.string(),
})
export type AnnouncementTextValues = z.infer<typeof announcementTextSchema>

export const scheduleShape = {
  publishDate: z.string(),
  publishTime: z.string(),
  expiresDate: z.string(),
  expiresTime: z.string(),
}

export const announcementSchema = announcementTextSchema.extend(scheduleShape)
export type AnnouncementValues = z.infer<typeof announcementSchema>

export function withScheduleRules<T extends z.ZodType<ScheduleFields>>(
  schema: T,
  initial: ScheduleFields = EMPTY_SCHEDULE,
) {
  return schema.superRefine((v, ctx) => {
    for (const issue of scheduleIssues(v, { initial })) {
      ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message })
    }
  })
}
