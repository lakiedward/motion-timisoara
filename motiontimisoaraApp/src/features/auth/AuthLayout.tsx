import * as React from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { usesNativeNavigation } from '@/layout/native/native-runtime'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const native = usesNativeNavigation()
  return (
    <div className={cn('grid', native ? 'py-4' : 'min-h-dvh lg:grid-cols-2')}>
      <div className={cn('relative hidden overflow-hidden', !native && 'lg:block')}>
        <img
          src="/ui/20230516_184053.webp"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
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
              Cluburi, antrenori și cursuri sportive pentru copii în Timișoara — găsești, înscrii și
              plătești într-un singur loc.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className={cn('mb-8 lg:hidden', native && 'hidden')}>
            <Link to="/" className="inline-flex items-center">
              <Logo />
            </Link>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
