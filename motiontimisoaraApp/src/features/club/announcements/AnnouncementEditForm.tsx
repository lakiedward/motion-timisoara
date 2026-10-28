import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { updateClubAnnouncement, type ClubAnnouncement } from '@/api/club'
import { Button } from '@/components/ui/button'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AnnouncementScheduleFields } from './AnnouncementScheduleFields'
import {
  PRIORITY_OPTIONS,
  announcementSchema,
  withScheduleRules,
  type AnnouncementValues,
  announcementSelectClassName,
} from './announcement-form'
import { scheduleFromFields, scheduleState, scheduleToFields } from './announcement-schedule'

type Props = {
  anunt: ClubAnnouncement
  onSaved: () => void
  onCancel: () => void
}

export function AnnouncementEditForm({ anunt, onSaved, onCancel }: Props) {
  const ids = {
    title: `edit-${anunt.id}-title`,
    content: `edit-${anunt.id}-content`,
    priority: `edit-${anunt.id}-priority`,
  }
  const initial = scheduleToFields(anunt)
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AnnouncementValues>({
    resolver: zodResolver(withScheduleRules(announcementSchema, initial)),
    defaultValues: {
      title: anunt.title,
      content: anunt.content,
      priority: anunt.priority,
      ...initial,
    },
  })

  const save = useMutation({
    mutationFn: (v: AnnouncementValues) =>
      updateClubAnnouncement(anunt.id, {
        title: v.title.trim(),
        content: v.content.trim(),
        priority: v.priority,
        ...scheduleFromFields(v),
      }),
    onSuccess: () => {
      onSaved()
      toast.success('Anunț actualizat.')
    },
    onError: () => toast.error('Nu am putut salva modificările.'),
  })

  return (
    <form
      onSubmit={handleSubmit((v) => (isDirty ? save.mutate(v) : onCancel()))}
      noValidate
      aria-label={`Editezi anunțul „${anunt.title}”`}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor={ids.title}>Titlu</Label>
        <Input
          id={ids.title}
          className="md:text-base"
          aria-invalid={!!errors.title}
          aria-describedby={fieldDescription(ids.title, undefined, errors.title?.message)}
          {...register('title')}
        />
        <FieldMessage id={ids.title} error={errors.title?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={ids.content}>Conținut</Label>
        <Textarea
          id={ids.content}
          rows={4}
          className="md:text-base"
          aria-invalid={!!errors.content}
          aria-describedby={fieldDescription(ids.content, undefined, errors.content?.message)}
          {...register('content')}
        />
        <FieldMessage id={ids.content} error={errors.content?.message} />
      </div>

      <AnnouncementScheduleFields
        idPrefix={`edit-${anunt.id}`}
        register={register}
        errors={errors}
        disabled={save.isPending}
      />

      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor={ids.priority}>Prioritate</Label>
          <select
            id={ids.priority}
            className={announcementSelectClassName}
            {...register('priority')}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onCancel}>
            Renunță
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Se salvează…' : 'Salvează'}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {scheduleState(anunt) === 'scheduled'
          ? 'Părinții văd anunțul și primesc notificarea la data publicării.'
          : 'Părinții văd textul nou imediat. Nu primesc o notificare nouă.'}
      </p>
    </form>
  )
}
