import * as React from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/Logo'

interface AuthLayoutProps {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

/** Split-screen auth shell: branded photo panel + form card (matches the old site). */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/ui/20230516_184053.webp" alt="" className="absolute inset-0 size-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(37,99,235,0.92) 0%, rgba(14,165,233,0.78) 100%)',
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <Link to="/" className="font-display text-xl font-extrabold">
            Motion Timișoara
          </Link>
          <div>
            <h2 className="font-display text-4xl leading-tight font-extrabold">
              Sportul copilului tău, într-un singur cont
            </h2>
            <p className="mt-3 max-w-sm text-white/85">
              Cluburi, antrenori și cursuri sportive pentru copii în Timișoara — găsești, înscrii
              și plătești într-un singur loc.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link to="/">
              <Logo />
            </Link>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && (
            <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>
          )}
        </div>
      </div>
    </div>
  )
}
