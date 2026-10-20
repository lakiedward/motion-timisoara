import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { incarcaAtasamente } from '@/api/attachments'
import { createCourseAnnouncement } from '@/api/coach-announcements'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import AnnouncementMediaPicker from '@/features/club/announcements/AnnouncementMediaPicker'
import type { FisierPregatit } from '@/lib/media'

const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const CHECKBOX =
  'accent-primary focus-visible:outline-ring size-5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2'

const schema = z.object({
  courseId: z.string().min(1, 'Alege cursul'),
  content: z.string().trim().min(2, 'Scrie conținutul anunțului'),
  pinned: z.boolean(),
})
type Values = z.infer<typeof schema>

type Props = {
  courses: { id: string; name: string }[]
  onPublished: () => void
  onCancel: () => void
}

export default function CoachAnnouncementForm({ courses, onPublished, onCancel }: Props) {
  const [files, setFiles] = useState<FisierPregatit[]>([])
  const empty: Values = {
    courseId: courses.length === 1 ? courses[0].id : '',
    content: '',
    pinned: false,
  }
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })

  const create = useMutation({
    mutationFn: async (v: Values) => {
      const announcement = await createCourseAnnouncement({
        courseId: v.courseId,
        content: v.content.trim(),
        pinned: v.pinned,
      })
      if (files.length) await incarcaAtasamente(announcement.id, files, 'coach')
      return announcement
    },
    onSuccess: () => {
      reset(empty)
      setFiles([])
      onPublished()
      toast.success('Anunț publicat.')
    },
    onError: () => toast.error('Nu am putut publica anunțul.'),
  })

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="font-display text-lg">Anunț nou</CardTitle>
        <CardDescription>
          Ajunge la părinții copiilor înscriși la curs, în aplicație și ca notificare.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="courseId">Cursul</Label>
            <select
              id="courseId"
              className={selectCls}
              aria-invalid={!!errors.courseId}
              aria-describedby={fieldDescription('courseId', undefined, errors.courseId?.message)}
              {...register('courseId')}
            >
              <option value="">Alege cursul</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldMessage id="courseId" error={errors.courseId?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">Ce s-a întâmplat sau ce urmează</Label>
            <Textarea
              id="content"
              rows={4}
              className="md:text-base"
              aria-invalid={!!errors.content}
              aria-describedby={fieldDescription('content', undefined, errors.content?.message)}
              {...register('content')}
            />
            <FieldMessage id="content" error={errors.content?.message} />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm leading-none font-medium select-none">
              Poze și filmare
            </legend>
            <AnnouncementMediaPicker
              files={files}
              onChange={setFiles}
              disabled={create.isPending}
            />
          </fieldset>

          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-h-touch-target cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className={CHECKBOX} {...register('pinned')} />
              Fixează sus la părinți
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={create.isPending}>
                Renunță
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Se publică…' : 'Publică'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
