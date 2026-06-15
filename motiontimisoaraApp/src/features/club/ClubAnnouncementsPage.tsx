import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createClubAnnouncement,
  deleteClubAnnouncement,
  getClubAnnouncements,
  getMyClub,
  setAnnouncementActive,
} from '@/api/club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const PRIORITY: Record<string, { label: string; variant: 'secondary' | 'default' | 'highlight' | 'destructive' }> = {
  LOW: { label: 'Scăzută', variant: 'secondary' },
  NORMAL: { label: 'Normală', variant: 'default' },
  HIGH: { label: 'Ridicată', variant: 'highlight' },
  URGENT: { label: 'Urgentă', variant: 'destructive' },
}

export default function ClubAnnouncementsPage() {
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState('NORMAL')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['club-announcements', clubId],
    queryFn: () => getClubAnnouncements(clubId!),
    enabled: !!clubId,
  })

  const create = useMutation({
    mutationFn: () => createClubAnnouncement({ club_id: clubId!, title, content, priority }),
    onSuccess: () => {
      setTitle('')
      setContent('')
      setPriority('NORMAL')
      qc.invalidateQueries({ queryKey: ['club-announcements', clubId] })
      toast.success('Anunț publicat.')
    },
    onError: () => toast.error('Nu am putut publica anunțul.'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setAnnouncementActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-announcements', clubId] }),
  })
  const del = useMutation({
    mutationFn: (id: string) => deleteClubAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-announcements', clubId] }),
  })

  const selectCls =
    'border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Anunțuri</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim().length >= 2 && content.trim().length >= 2 && clubId) create.mutate()
        }}
        className="bg-card shadow-card mb-6 space-y-3 rounded-3xl border p-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Titlu</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="content">Conținut</Label>
          <textarea
            id="content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="priority">Prioritate</Label>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={cn(selectCls)}>
              <option value="LOW">Scăzută</option>
              <option value="NORMAL">Normală</option>
              <option value="HIGH">Ridicată</option>
              <option value="URGENT">Urgentă</option>
            </select>
          </div>
          <Button type="submit" disabled={create.isPending}>
            Publică
          </Button>
        </div>
      </form>

      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : items.length ? (
        <ul className="space-y-3">
          {items.map((a) => {
            const p = PRIORITY[a.priority] ?? PRIORITY.NORMAL
            return (
              <li key={a.id} className="bg-card shadow-card rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{a.title}</h3>
                      <Badge variant={p.variant}>{p.label}</Badge>
                      {!a.is_active && <Badge variant="outline">Ascuns</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">{a.content}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: a.id, active: !a.is_active })}>
                    {a.is_active ? 'Ascunde' : 'Afișează'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(a.id)}>
                    <Trash2 /> Șterge
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
          Niciun anunț încă.
        </div>
      )}
    </div>
  )
}
