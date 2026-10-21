import { z } from 'zod'

export const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

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
