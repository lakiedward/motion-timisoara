import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'

const CTA_IMG = '/ui/20210405_152345.webp'

export function HomeFinalCta() {
  const { user } = useAuth()

  return (
    <section aria-labelledby="home-cta-title" className="mx-auto max-w-7xl px-6 pb-20 md:pb-24">
      <div className="relative overflow-hidden rounded-3xl px-6 py-14 sm:px-10 md:px-14 md:py-20">
        <img src={CTA_IMG} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-90"
          style={{ background: 'var(--gradient-primary)' }}
        />
        <div className="relative max-w-lg">
          <h2 id="home-cta-title" className="font-display text-3xl font-extrabold text-white md:text-5xl">
            Începe cu primul curs
          </h2>
          {user ? (
            <>
              <p className="mt-3 text-lg text-white">
                Alege un program nou pentru copilul tău din cursurile publicate de cluburi.
              </p>
              <Link to="/cursuri" className="btn-cta btn-cta--white mt-8">
                Vezi cursurile <ArrowRight aria-hidden="true" className="size-5" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-lg text-white">
                Creează un cont gratuit și înscrie-ți copilul la primul curs astăzi.
              </p>
              <Link to="/signup" className="btn-cta btn-cta--white mt-8">
                Creează cont <ArrowRight aria-hidden="true" className="size-5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
