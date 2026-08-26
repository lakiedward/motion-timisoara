import { useQuery } from '@tanstack/react-query'
import { Pin } from 'lucide-react'

import { getMyAnnouncements } from '@/api/account'
import { Skeleton } from '@/components/ui/skeleton'

export default function AnnouncementsPage() {
  // Pagina citea doar `course_announcements`, scrise de antrenor. Anunțurile
  // clubului există într-o tabelă separată, a cărei politică de citire a fost
  // gândită pentru părinți — dar nicio pagină nu o interoga, deci un anunț de
  // club nu ajungea la nimeni. Acum lista le adună pe amândouă.
  const {
    data: announcements = [],
    isLoading,
  } = useQuery({
    queryKey: ['my-announcements'],
    queryFn: getMyAnnouncements,
  })

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Anunțuri</h1>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ) : announcements.length ? (
        <ul className="space-y-4">
          {announcements.map((a) => (
            <li key={`${a.sursa}-${a.id}`} className="bg-card shadow-card rounded-3xl border p-5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {a.pinned && (
                  <span className="bg-highlight/15 text-highlight inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                    <Pin className="size-3" /> Fixat
                  </span>
                )}
                <span className="text-primary text-sm font-semibold">{a.autor}</span>
                {/* Părintele trebuie să știe dacă vorbește antrenorul cursului
                    sau clubul: sunt două voci diferite, cu greutăți diferite. */}
                <span className="text-muted-foreground text-xs">
                  {a.sursa === 'club' ? 'Anunț de club' : 'Anunț de la antrenor'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(a.created_at).toLocaleDateString('ro-RO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {a.title && <h2 className="mb-1 font-semibold">{a.title}</h2>}
              <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{a.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun anunț încă. Anunțurile de la cursurile copiilor tăi vor apărea aici.
        </div>
      )}
    </div>
  )
}
