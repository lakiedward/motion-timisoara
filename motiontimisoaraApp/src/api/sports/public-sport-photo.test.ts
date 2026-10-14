import { expect, test, vi } from 'vitest'

import { courseHeroUrl } from '../public'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.test/${bucket}/${path}` },
        }),
      }),
    },
  },
}))

test('the course photo takes precedence over its sport standard photo', () => {
  expect(
    courseHeroUrl({
      course_photos: [{ storage_path: 'own.jpg', display_order: 0 }],
      sport: { default_photo_storage_path: 'sport/default.jpg' },
    }),
  ).toBe('https://example.test/course-photos/own.jpg')
})

test('a course without its own photo uses the confirmed sport standard photo', () => {
  expect(
    courseHeroUrl({ course_photos: [], sport: { default_photo_storage_path: 'sport/new.jpg' } }),
  ).toBe('https://example.test/sport-photos/sport/new.jpg')
  expect(
    courseHeroUrl({ course_photos: [], sport: { default_photo_storage_path: null } }),
  ).toBeNull()
})

test('the course main photo shown on its details page takes precedence over the gallery and sport photo', () => {
  expect(
    courseHeroUrl({
      hero_photo_storage_path: 'course/hero.jpg',
      course_photos: [{ storage_path: 'gallery.jpg', display_order: 0 }],
      sport: { default_photo_storage_path: 'sport/default.jpg' },
    }),
  ).toBe('https://example.test/course-photos/course/hero.jpg')
  expect(
    courseHeroUrl({
      hero_photo_storage_path: null,
      course_photos: [{ storage_path: 'gallery.jpg', display_order: 0 }],
      sport: { default_photo_storage_path: 'sport/default.jpg' },
    }),
  ).toBe('https://example.test/course-photos/gallery.jpg')
})
