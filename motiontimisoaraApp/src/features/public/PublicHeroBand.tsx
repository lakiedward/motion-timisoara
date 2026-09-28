import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PublicHeroBand({
  url,
  title,
  backTo,
  backLabel,
}: {
  url: string | null
  title: string
  backTo: string
  backLabel: string
}) {
  if (!url) return null
  return (
    <section className="relative h-[46vh] min-h-[320px] overflow-hidden md:h-[52vh]">
      <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.25) 48%, transparent 72%)',
        }}
      />
      <Link
        to={backTo}
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3.5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/45"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto max-w-6xl px-6 pb-7">
          <h1 className="font-display text-4xl font-extrabold text-white md:text-5xl">{title}</h1>
        </div>
      </div>
    </section>
  )
}
