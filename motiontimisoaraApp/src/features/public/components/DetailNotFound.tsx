import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function DetailNotFound({
  title,
  text,
  backTo,
  backLabel,
}: {
  title: string
  text: string
  backTo: string
  backLabel: string
}) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
      <div className="from-primary/15 to-sky/10 w-full rounded-xl border bg-gradient-to-br p-10">
        <h1 className="font-display text-foreground text-2xl font-extrabold">{title}</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{text}</p>
        <Link
          to={backTo}
          className="btn-cta btn-cta--primary mt-8 inline-flex items-center justify-center gap-2"
        >
          <ArrowLeft className="size-4" /> {backLabel}
        </Link>
      </div>
    </div>
  )
}
