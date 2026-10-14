import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Mail, MapPin, Phone } from 'lucide-react'

import { submitContactForm } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Field, FieldMessage, fieldDescription } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  name: z.string().trim().min(2, 'Introdu numele tău, minim 2 caractere'),
  email: z.string().email('Introdu o adresă de email validă, ex. nume@exemplu.ro'),
  subject: z.string().optional(),
  message: z.string().trim().min(10, 'Scrie un mesaj de cel puțin 10 caractere'),
})
type Values = z.infer<typeof schema>

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    setFailed(false)
    try {
      await submitContactForm(v)
      setSent(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <span className="eyebrow mb-3">Contact</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Hai să vorbim</h1>
          <p className="text-muted-foreground mt-3">
            Ai întrebări despre cursuri sau înscrieri? Scrie-ne și revenim cât mai repede.
          </p>
          <div className="mt-8 space-y-4 text-sm">
            <a href="tel:+40750420455" className="hover:text-primary min-h-touch-target flex w-fit items-center gap-3 rounded-xl underline-offset-4 transition-colors hover:underline">
              <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
                <Phone className="size-4" />
              </span>
              +40 750 420 455
            </a>
            <a href="mailto:contact@motiontimisoara.com" className="hover:text-primary min-h-touch-target flex w-fit items-center gap-3 rounded-xl underline-offset-4 transition-colors hover:underline">
              <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
                <Mail className="size-4" />
              </span>
              contact@motiontimisoara.com
            </a>
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
                <MapPin className="size-4" />
              </span>
              Timișoara, România
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          {sent ? (
            <p className="bg-success/10 text-success-ink rounded-md px-3 py-4 text-sm">
              Mulțumim! Mesajul tău a fost trimis — revenim în cel mai scurt timp.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Field
                id="name"
                label="Nume"
                aria-required
                autoComplete="name"
                error={errors.name?.message}
                {...register('name')}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                aria-required
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Field id="subject" label="Subiect (opțional)" {...register('subject')} />
              <div className="space-y-1.5">
                <Label htmlFor="message">Mesaj</Label>
                <Textarea
                  id="message"
                  rows={4}
                  aria-required
                  aria-invalid={!!errors.message}
                  aria-describedby={fieldDescription('message', undefined, errors.message?.message)}
                  {...register('message')}
                />
                <FieldMessage id="message" error={errors.message?.message} />
              </div>
              {failed && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border p-4 text-sm">
                  <span className="bg-destructive/15 text-destructive grid size-10 shrink-0 place-items-center rounded-full">
                    <AlertCircle className="size-5" />
                  </span>
                  <div>
                    <p className="text-foreground font-semibold">Nu am putut trimite mesajul.</p>
                    <p className="text-muted-foreground mt-1">
                      Mesajul tău a rămas în formular. Reîncearcă sau scrie-ne la contact@motiontimisoara.com.
                    </p>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Se trimite…' : failed ? 'Reîncearcă' : 'Trimite mesajul'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
