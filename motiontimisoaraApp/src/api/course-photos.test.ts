import { expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (cale: string) => ({
          data: { publicUrl: `https://cdn.test/${bucket}/${cale}` },
        }),
      }),
    },
  },
}))

import { galeriaPublicaCurs } from './course-photos'

test('ordonează după display_order și curăță descrierile goale', () => {
  expect(
    galeriaPublicaCurs([
      { storage_path: 'c/gallery/b.jpg', display_order: 1, caption: '  ' },
      { storage_path: 'c/gallery/a.jpg', display_order: 0, caption: ' Încălzirea ' },
    ]),
  ).toEqual([
    { url: 'https://cdn.test/course-photos/c/gallery/a.jpg', caption: 'Încălzirea' },
    { url: 'https://cdn.test/course-photos/c/gallery/b.jpg', caption: null },
  ])
})

test('nu repetă în galerie poza din capul paginii', () => {
  expect(
    galeriaPublicaCurs(
      [
        { storage_path: '/ui/hero.webp', display_order: 0, caption: null },
        { storage_path: 'c/gallery/a.jpg', display_order: 1, caption: null },
      ],
      '/ui/hero.webp',
    ),
  ).toEqual([{ url: 'https://cdn.test/course-photos/c/gallery/a.jpg', caption: null }])
})

test('fără poze întoarce o listă goală', () => {
  expect(galeriaPublicaCurs(null)).toEqual([])
})
