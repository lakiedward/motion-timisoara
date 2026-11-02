import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getAdminUserProfile,
  updateAdminUserProfile,
  type AdminUserProfile,
} from '@/api/accounts/admin-accounts'
import { FormSection, RequiredFieldsNote, RequiredMark } from '@/components/FormSection'
import { BackLink } from '@/components/page-header/PageHeader'
import { Button } from '@/components/ui/button'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { Textarea } from '@/components/ui/textarea'
import { RoleBadge, StatusBadge } from './UserParts'
import { adminUserSchema, toPatch, type AdminUserParsed, type AdminUserValues } from './user-edit'

function UserForm({ user }: { user: AdminUserProfile }) {
  const qc = useQueryClient()
  const isCoach = user.role === 'COACH'
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminUserValues, unknown, AdminUserParsed>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: { name: user.name, phone: user.phone ?? '', bio: user.bio ?? '' },
  })

  useEffect(() => {
    reset({ name: user.name, phone: user.phone ?? '', bio: user.bio ?? '' })
  }, [user, reset])

  const onSubmit = async (v: AdminUserParsed) => {
    try {
      await updateAdminUserProfile(user, toPatch(v, user))
      void qc.invalidateQueries({ queryKey: ['admin-user', user.id] })
      void qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`Datele lui ${v.name} au fost salvate.`)
    } catch {
      toast.error('Nu am putut salva utilizatorul.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <FormSection title="Date de contact">
        <div className="space-y-1.5">
          <Label htmlFor="admin-user-name">
            Nume <RequiredMark />
          </Label>
          <Input
            id="admin-user-name"
            autoComplete="off"
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={fieldDescription('admin-user-name', undefined, errors.name?.message)}
            {...register('name')}
          />
          <FieldMessage id="admin-user-name" error={errors.name?.message} />
        </div>
        {user.phoneKnown && (
          <div className="space-y-1.5">
            <Label htmlFor="admin-user-phone">Telefon</Label>
            <Input
              id="admin-user-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+40..."
              aria-invalid={!!errors.phone}
              aria-describedby={fieldDescription(
                'admin-user-phone',
                undefined,
                errors.phone?.message,
              )}
              {...register('phone')}
            />
            <FieldMessage id="admin-user-phone" error={errors.phone?.message} />
          </div>
        )}
        {isCoach && (
          <div className="space-y-1.5">
            <Label htmlFor="admin-user-bio">Bio</Label>
            <Textarea
              id="admin-user-bio"
              rows={4}
              aria-describedby="admin-user-bio-hint"
              {...register('bio')}
            />
            <p id="admin-user-bio-hint" className="text-muted-foreground text-xs">
              Apare pe pagina publică a antrenorului.
            </p>
          </div>
        )}
      </FormSection>
      <FormSection
        title="Cont"
        description="Emailul cu care utilizatorul intră în cont nu se poate schimba de aici."
      >
        <div className="space-y-1.5">
          <Label htmlFor="admin-user-email">Email</Label>
          <Input
            id="admin-user-email"
            type="email"
            value={user.email}
            readOnly
            className="bg-muted"
          />
        </div>
        {user.role === 'CLUB' && (
          <p className="text-muted-foreground text-sm">
            Datele publice ale clubului se editează din{' '}
            <Link to="/admin/clubs" className="text-primary font-semibold">
              Cluburi
            </Link>
            .
          </p>
        )}
      </FormSection>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting} className="h-touch-target min-h-touch-target">
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
        <Button asChild variant="outline" className="h-touch-target min-h-touch-target">
          <Link to="/admin/users">Anulează</Link>
        </Button>
      </div>
    </form>
  )
}

export default function AdminUserEditPage() {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getAdminUserProfile(id),
    retry: false,
  })

  if (query.isPending)
    return (
      <div role="status" aria-label="Se încarcă utilizatorul" className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )

  if (query.isError || !query.data)
    return (
      <div className="max-w-2xl">
        <BackLink to="/admin/users">Înapoi la utilizatori</BackLink>
        <StatusView
          state="error"
          title={query.isError ? 'Nu am putut încărca utilizatorul.' : 'Utilizatorul nu există.'}
          text={query.isError ? 'Verifică conexiunea și încearcă din nou.' : undefined}
          onRetry={query.isError ? () => void query.refetch() : undefined}
          retrying={query.isFetching}
        />
      </div>
    )

  const user = query.data
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <BackLink to="/admin/users">Înapoi la utilizatori</BackLink>
        <h1 className="font-display text-foreground text-2xl font-bold break-words">
          Editează {user.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RoleBadge role={user.role} />
          <StatusBadge enabled={user.enabled} />
        </div>
        <RequiredFieldsNote />
      </div>
      <UserForm user={user} />
    </div>
  )
}
