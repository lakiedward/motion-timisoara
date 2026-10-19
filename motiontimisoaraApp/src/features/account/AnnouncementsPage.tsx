import { useEffect, useState, type ReactNode } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import {
  getParentAnnouncementCourses,
  getParentAnnouncementFeed,
  markParentAnnouncementsSeen,
  type AnnouncementCursor,
  type FeedPage,
} from '@/api/announcements/parent'
import { useAuth } from '@/lib/auth-context'
import { LiveLocationBanner } from '@/features/live-location/parent/LiveLocationBanner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'
import { AnnouncementFeed } from './announcements/AnnouncementFeed'
import { LiveLocationAnnouncements } from './announcements/LiveLocationAnnouncements'
import { CourseSelect } from './announcements/CourseFilter'

function FeedSkeleton() {
  return <StatusView state="loading" title="Se încarcă anunțurile" rows={2} rowHeight={140} />
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <StatusView
      state="error"
      title="Nu am putut încărca anunțurile."
      text="Verifică conexiunea și încearcă din nou."
      onRetry={onRetry}
    />
  )
}

type CourseFilterState = { courseId: string; revision: number }

function ParentAnnouncementList({
  initialPage,
  userId,
  visitId,
  filter,
  changeCourse,
}: {
  initialPage: FeedPage
  userId: string
  visitId: string
  filter: CourseFilterState
  changeCourse: (courseId: string) => void
}) {
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

  const pages = feed.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const count = items.length
  const feedChanged = feed.error != null && 'code' in feed.error && feed.error.code === 'PT409'

  return (
    <div className="space-y-4">
      {visitError && (
        <div role="alert" className="bg-card rounded-xl border p-4">
          <p className="text-sm">
            Nu am putut salva ultima vizită. Marcajele „Nou” pot reapărea data viitoare.
          </p>
          <Button
            variant="outline"
            className="mt-2"
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
        <FeedError onRetry={() => void feed.refetch()} />
      ) : count ? (
        <>
          <AnnouncementFeed
            items={items}
            userId={userId}
            previousSeenAt={initialPage.previousSeenAt}
          />
          {feed.isError && (
            <div role="alert" className="bg-card rounded-xl border p-4">
              <p className="text-sm">
                {feedChanged
                  ? 'Lista anunțurilor s-a schimbat. Reîncarcă lista pentru a vedea ordinea actuală.'
                  : 'Nu am putut încărca restul anunțurilor. Mesajele afișate sunt păstrate.'}
              </p>
              <Button
                className="mt-2"
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
          <div className="flex flex-col items-center gap-3 pt-2">
            {feed.hasNextPage && !feed.isError && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => void feed.fetchNextPage()}
                disabled={feed.isFetching}
              >
                {feed.isFetchingNextPage ? 'Se încarcă…' : 'Încarcă mai multe'}
              </Button>
            )}
            <p className="text-muted-foreground text-sm" role="status">
              {plural(count, 'anunț afișat', 'anunțuri afișate')}
            </p>
          </div>
        </>
      ) : (
        <StatusView
          state="empty"
          title={filter.courseId ? 'Niciun anunț pentru cursul ales.' : 'Niciun anunț încă.'}
          text={
            filter.courseId
              ? 'Alege alt curs sau vezi toate anunțurile.'
              : 'Anunțurile de la cursurile copiilor tăi și de la cluburile la care sunt înscriși vor apărea aici.'
          }
          action={
            filter.courseId ? (
              <Button variant="outline" className="mt-3" onClick={() => changeCourse('')}>
                Arată toate anunțurile
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}

function AnnouncementVisit({ userId }: { userId: string }) {
  const [visitId] = useState(() => crypto.randomUUID())
  const [filter, setFilter] = useState<CourseFilterState>({ courseId: '', revision: 0 })
  const [firstPageLoaded, setFirstPageLoaded] = useState(false)
  const courses = useQuery({
    queryKey: ['parent-announcement-courses', userId],
    queryFn: getParentAnnouncementCourses,
    enabled: firstPageLoaded,
    retry: false,
  })
  const firstPage = useQuery({
    queryKey: ['parent-announcement-visit', userId, visitId],
    queryFn: async () => {
      const page = await getParentAnnouncementFeed()
      setFirstPageLoaded(true)
      return page
    },
    staleTime: Infinity,
    retry: false,
  })
  const changeCourse = (courseId: string) =>
    setFilter((previous) => ({ courseId, revision: previous.revision + 1 }))
  const filterControl = !firstPageLoaded ? null : courses.isPending ? (
    <Skeleton className="h-11 w-full rounded-md sm:w-56" aria-label="Se încarcă lista cursurilor" />
  ) : courses.isError ? (
    <div role="alert" className="bg-card rounded-xl border p-4">
      <p className="text-sm">Nu am putut încărca lista cursurilor.</p>
      <Button
        variant="outline"
        className="mt-2"
        onClick={() => void courses.refetch()}
        disabled={courses.isFetching}
      >
        Reîncearcă lista cursurilor
      </Button>
    </div>
  ) : courses.data?.length ? (
    <CourseSelect courses={courses.data} value={filter.courseId} onChange={changeCourse} />
  ) : null

  return (
    <>
      <PageHeader filter={filterControl} />
      <div className="mb-6">
        <LiveLocationBanner always />
      </div>
      <LiveLocationAnnouncements />
      {firstPage.isPending ? (
        <FeedSkeleton />
      ) : firstPage.isError ? (
        <FeedError onRetry={() => void firstPage.refetch()} />
      ) : (
        <ParentAnnouncementList
          initialPage={firstPage.data}
          userId={userId}
          visitId={visitId}
          filter={filter}
          changeCourse={changeCourse}
        />
      )}
    </>
  )
}

function PageHeader({ filter }: { filter?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <h1 className="font-display text-2xl font-bold">Anunțuri</h1>
      {filter}
    </div>
  )
}

export default function AnnouncementsPage() {
  const { user } = useAuth()
  return <div>{user ? <AnnouncementVisit key={user.id} userId={user.id} /> : <PageHeader />}</div>
}
