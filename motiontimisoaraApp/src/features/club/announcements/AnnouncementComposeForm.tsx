import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createClubAnnouncement, type AudienceKind, type ClubAudience } from '@/api/club'
import { incarcaAtasamente } from '@/api/attachments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FisierPregatit } from '@/lib/media'
import AnnouncementMediaPicker from './AnnouncementMediaPicker'
import { PRIORITY_OPTIONS, announcementTextSchema, selectCls } from './announcement-form'

const WHOLE_CLUB = 'CLUB'

const AUDIENCE_GROUPS: { kind: AudienceKind; label: string }[] = [
  { kind: 'COURSE', label: 'Cursuri' },
  { kind: 'ACTIVITY', label: 'Activități' },
  { kind: 'CAMP', label: 'Tabere' },
]

const schema = announcementTextSchema.extend({ audience: z.string() })
type Values = z.infer<typeof schema>

const EMPTY_FORM: Values = {
  title: '',
  content: '',
  priority: 'NORMAL',
  audience: WHOLE_CLUB,
}

function readAudience(value: string): { kind: AudienceKind; id: string | null } {
  if (value === WHOLE_CLUB) return { kind: 'CLUB', id: null }
  const [kind, id] = value.split(':')
  return { kind: kind as AudienceKind, id: id ?? null }
}

type Props = {
  clubId: string
  audiences: ClubAudience[]
  onPublished: () => void
}

export default function AnnouncementComposeForm({ clubId, audiences, onPublished }: Props) {
  const [files, setFiles] = useState<FisierPregatit[]>([])
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY_FORM })

  const create = useMutation({
    mutationFn: async (v: Values) => {
      const audience = readAudience(v.audience)
      const announcement = await createClubAnnouncement({
        club_id: clubId,
        title: v.title.trim(),
        content: v.content.trim(),
        priority: v.priority,
        audience_kind: audience.kind,
        audience_id: audience.id,
      })
      if (files.length) await incarcaAtasamente(announcement.id, files)
      return announcement
    },
    onSuccess: () => {
      reset(EMPTY_FORM)
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
        <CardDescription>Ajunge la părinți în aplicație și ca notificare.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titlu</Label>
            <Input
              id="title"
              className="md:text-base"
              aria-invalid={!!errors.title}
              aria-describedby={fieldDescription('title', undefined, errors.title?.message)}
              {...register('title')}
            />
            <FieldMessage id="title" error={errors.title?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">Conținut</Label>
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

          <div className="space-y-1.5">
            <Label htmlFor="audience">Cine primește</Label>
            <select id="audience" className={selectCls} {...register('audience')}>
              <option value={WHOLE_CLUB}>Toți părinții clubului</option>
              {AUDIENCE_GROUPS.map(({ kind, label }) => {
                const options = audiences.filter((a) => a.kind === kind)
                if (!options.length) return null
                return (
                  <optgroup key={kind} label={label}>
                    {options.map((a) => (
                      <option key={a.id} value={`${a.kind}:${a.id}`}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            <p className="text-muted-foreground text-xs">
              Anunțul ajunge doar la părinții cu un copil înscris activ.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5 sm:w-56">
              <Label htmlFor="priority">Prioritate</Label>
              <select id="priority" className={selectCls} {...register('priority')}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={create.isPending || !clubId}>
              {create.isPending ? 'Se publică…' : 'Publică'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
