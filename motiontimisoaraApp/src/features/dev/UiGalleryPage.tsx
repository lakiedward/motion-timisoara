import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { StarRating } from '@/components/StarRating'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      <Separator />
    </section>
  )
}

export default function UiGalleryPage() {
  const [rating, setRating] = useState(0)

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header>
        <h1 className="text-3xl font-bold">Galerie componente</h1>
        <p className="text-muted-foreground mt-1">
          Referință vizuală pentru design system-ul „Sportiv energic”.
        </p>
      </header>

      <Section title="Butoane">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Destructive</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Badge-uri">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">Plătit</Badge>
        <Badge variant="highlight">Nou</Badge>
        <Badge variant="destructive">Anulat</Badge>
      </Section>

      <Section title="Card">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Curs de înot</CardTitle>
            <CardDescription>Începători · 6–10 ani</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Exemplu de card cu titlu, descriere și conținut.
          </CardContent>
        </Card>
      </Section>

      <Section title="Formular">
        <div className="w-72 space-y-2">
          <Label htmlFor="demo-email">Email</Label>
          <Input id="demo-email" type="email" placeholder="nume@exemplu.ro" />
        </div>
      </Section>

      <Section title="Avatar">
        <Avatar>
          <AvatarImage src="/broken.png" alt="" />
          <AvatarFallback>MT</AvatarFallback>
        </Avatar>
        <Avatar className="size-12">
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
      </Section>

      <Section title="Rating">
        <StarRating value={3.5} />
        <StarRating value={rating} onChange={setRating} />
        <span className="text-muted-foreground text-sm">selectat: {rating}</span>
      </Section>

      <Section title="Skeleton">
        <div className="w-72 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Section>

      <Section title="Toast">
        <Button onClick={() => toast.success('Înscriere confirmată!')}>Succes</Button>
        <Button variant="destructive" onClick={() => toast.error('Plata a eșuat.')}>
          Eroare
        </Button>
      </Section>
    </div>
  )
}
