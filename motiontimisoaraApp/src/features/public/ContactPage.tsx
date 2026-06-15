import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, MapPin, Phone } from 'lucide-react'

import { submitContactForm } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  email: z.string().email('Email invalid'),
  subject: z.string().optional(),
  message: z.string().min(10, 'Minim 10 caractere'),
})
type Values = z.infer<typeof schema>

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    await submitContactForm(v)
    setSent(true)
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
            <a href="tel:+40750420455" className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
                <Phone className="size-4" />
              </span>
              +40 750 420 455
            </a>
            <a href="mailto:contact@motiontimisoara.com" className="flex items-center gap-3">
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

        <div className="bg-card shadow-card rounded-3xl border p-6">
          {sent ? (
            <p className="bg-success/10 text-success rounded-md px-3 py-4 text-sm">
              Mulțumim! Mesajul tău a fost trimis — revenim în cel mai scurt timp.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nume</Label>
                <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
                {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subiect (opțional)</Label>
                <Input id="subject" {...register('subject')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Mesaj</Label>
                <textarea
                  id="message"
                  rows={4}
                  {...register('message')}
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                />
                {errors.message && <p className="text-destructive text-xs">{errors.message.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Se trimite…' : 'Trimite mesajul'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
