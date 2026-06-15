import { Link } from 'react-router-dom'

import { Logo } from '@/components/Logo'

const GROUPS = [
  {
    title: 'Programe',
    links: [
      { to: '/cursuri', label: 'Cursuri' },
      { to: '/activitati', label: 'Activități' },
      { to: '/tabere', label: 'Tabere' },
    ],
  },
  {
    title: 'Echipă',
    links: [
      { to: '/antrenori', label: 'Antrenori' },
      { to: '/cluburi', label: 'Cluburi' },
      { to: '/harta', label: 'Hartă' },
    ],
  },
  {
    title: 'Companie',
    links: [
      { to: '/despre', label: 'Despre noi' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/termeni', label: 'Termeni' },
      { to: '/confidentialitate', label: 'Confidențialitate' },
      { to: '/gdpr', label: 'GDPR' },
    ],
  },
]

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-border bg-muted/30 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm">
            Sport pentru copii în Timișoara — cursuri, tabere și activități multi-sport, alături de
            antrenori și cluburi de încredere.
          </p>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title} className="space-y-3">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-border/60 border-t">
        <div className="text-muted-foreground mx-auto max-w-7xl px-4 py-6 text-center text-sm">
          © {year} Motion Timișoara. Toate drepturile rezervate.
        </div>
      </div>
    </footer>
  )
}
