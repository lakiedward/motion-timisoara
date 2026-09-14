import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import {
  getParentAnnouncementCourses,
  getParentAnnouncementFeed,
  markParentAnnouncementsSeen,
  type AnnouncementCursor,
  type FeedPage,
} from '@/api/announcements/parent'
import { useAuth } from '@/lib/auth-context'
import { ActiveLocationAnnouncements } from '@/features/live-location/camps/ActiveLocationAnnouncements'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AnnouncementRows } from './announcements/AnnouncementRows'

function FeedSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Se încarcă anunțurile">
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-28 rounded-3xl" />
    </div>
  )
}

function ParentAnnouncementList({
  initialPage,
  userId,
  visitId,
}: {
  initialPage: FeedPage
  userId: string
  visitId: string
}) {
  const [filter, setFilter] = useState({ courseId: '', revision: 0 })
  const courses = useQuery({
    queryKey: ['parent-announcement-courses', userId],
    queryFn: getParentAnnouncementCourses,
    retry: false,
  })
  const feed = useInfiniteQuery({
    queryKey: ['parent-announcement-feed', userId, visitId, filter.courseId, filter.revision],
    initialPageParam: null as AnnouncementCursor | null,
    initialData: filter.revision === 0 ? { pages: [initialPage], pageParams: [null] } : undefined,
    queryFn: ({ pageParam }) =>
      getParentAnnouncementFeed({
        courseId: filter.courseId || undefined,
        cursor: pageParam ?? undefined,
        asOf: initialPage.asOf,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: Infinity,
    retry: false,
  })
  const {
    mutate: saveVisit,
    isError: visitError,
    isPending: savingVisit,
  } = useMutation({
    mutationFn: (asOf: string) => markParentAnnouncementsSeen(asOf, userId),
    retry: 1,
  })
  useEffect(() => {
    saveVisit(initialPage.asOf)
  }, [initialPage.asOf, saveVisit])

  const changeCourse = (courseId: string) =>
    setFilter((previous) => ({
      courseId,
      revision: previous.revision + 1,
    }))
  const pages = feed.data?.pages ?? []
  const count = pages.reduce((total, page) => total + page.items.length, 0)
  const feedChanged = feed.error != null && 'code' in feed.error && feed.error.code === 'PT409'

  return (
    <div className="space-y-4">
      {courses.isPending ? (
        <Skeleton
          className="h-11 w-full max-w-sm rounded-md"
          aria-label="Se încarcă lista cursurilor"
        />
      ) : courses.isError ? (
        <div role="alert" className="bg-card rounded-2xl border p-4">
          <p className="text-sm">Nu am putut încărca lista cursurilor.</p>
          <Button
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => void courses.refetch()}
            disabled={courses.isFetching}
          >
            Reîncearcă lista cursurilor
          </Button>
        </div>
      ) : (
        !!courses.data?.length && (
          <div className="space-y-1.5">
            <Label htmlFor="announcement-course">Filtrează după curs</Label>
            <select
              id="announcement-course"
              value={filter.courseId}
              onChange={(event) => changeCourse(event.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-11 w-full max-w-sm rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
            >
              <option value="">Toate anunțurile</option>
              {courses.data.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        )
      )}

      {visitError && (
        <div role="alert" className="bg-card rounded-2xl border p-4">
          <p className="text-sm">
            Nu am putut salva ultima vizită. Marcajele „Nou” pot reapărea data viitoare.
          </p>
          <Button
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => saveVisit(initialPage.asOf)}
            disabled={savingVisit}
          >
            Reîncearcă salvarea vizitei
          </Button>
        </div>
      )}

      {feed.isPending ? (
        <FeedSkeleton />
      ) : feed.isError && !pages.length ? (
        <div role="alert" className="rounded-3xl border border-dashed p-8 text-center">
          <p className="font-medium">Nu am putut încărca anunțurile.</p>
          <Button
            className="mt-4 min-h-11"
            onClick={() => void feed.refetch()}
            disabled={feed.isFetching}
          >
            Reîncearcă
          </Button>
        </div>
      ) : count ? (
        <>
          <ul className="space-y-4" aria-label="Anunțuri">
            {pages.map((page, index) => (
              <AnnouncementRows
                key={index}
                items={page.items}
                userId={userId}
                previousSeenAt={initialPage.previousSeenAt}
              />
            ))}
          </ul>
          {feed.isError && (
            <div role="alert" className="bg-card rounded-2xl border p-4">
              <p className="text-sm">
                {feedChanged
                  ? 'Lista anunțurilor s-a schimbat. Reîncarcă lista pentru a vedea ordinea actuală.'
                  : 'Nu am putut încărca restul anunțurilor. Mesajele afișate sunt păstrate.'}
              </p>
              <Button
                className="mt-2 min-h-11"
                variant="outline"
                onClick={() => {
                  if (feedChanged) changeCourse(filter.courseId)
                  else void (feed.isFetchNextPageError ? feed.fetchNextPage() : feed.refetch())
                }}
                disabled={feed.isFetching}
              >
                {feedChanged ? 'Reîncarcă lista' : 'Reîncearcă încărcarea'}
              </Button>
            </div>
          )}
          {feed.hasNextPage && !feed.isError && (
            <Button
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void feed.fetchNextPage()}
              disabled={feed.isFetching}
            >
              {feed.isFetchingNextPage ? 'Se încarcă…' : 'Încarcă mai multe'}
            </Button>
          )}
          <p className="text-muted-foreground text-sm" role="status">
            {count} {count === 1 ? 'anunț afișat' : 'anunțuri afișate'}
          </p>
        </>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed p-8 text-center">
          {filter.courseId ? (
            <>
              <p>Niciun anunț pentru cursul ales.</p>
              <Button variant="outline" className="mt-4 min-h-11" onClick={() => changeCourse('')}>
                Arată toate anunțurile
              </Button>
            </>
          ) : (
            <p>
              Niciun mesaj încă. Aici apar anunțurile de la cursurile copiilor tăi și cele de la
              cluburile la care sunt înscriși.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function AnnouncementVisit({ userId }: { userId: string }) {
  const [visitId] = useState(() => crypto.randomUUID())
  const firstPage = useQuery({
    queryKey: ['parent-announcement-visit', userId, visitId],
    queryFn: () => getParentAnnouncementFeed(),
    staleTime: Infinity,
    retry: false,
  })
  return firstPage.isPending ? (
    <FeedSkeleton />
  ) : firstPage.isError ? (
    <div role="alert" className="rounded-3xl border border-dashed p-8 text-center">
      <p className="font-medium">Nu am putut încărca anunțurile.</p>
      <Button
        className="mt-4 min-h-11"
        onClick={() => void firstPage.refetch()}
        disabled={firstPage.isFetching}
      >
        Reîncearcă
      </Button>
    </div>
  ) : (
    <ParentAnnouncementList initialPage={firstPage.data} userId={userId} visitId={visitId} />
  )
}

export default function AnnouncementsPage() {
  const { user } = useAuth()
  return (
    <div className="max-w-3xl">
      <h1 className="font-display mb-6 text-2xl font-bold">Anunțuri</h1>
      <ActiveLocationAnnouncements />
      {user && <AnnouncementVisit key={user.id} userId={user.id} />}
    </div>
  )
}
