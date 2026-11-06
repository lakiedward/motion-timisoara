import { expect, test } from 'vitest'

import { descriereActivitatePreview, pozeActivitatePreview } from './preview-activity'

const ID_PREVIEW = '74a9d327-fb4e-450f-866f-f24575edc204'

test('o activitate obișnuită își păstrează descrierea', () => {
  expect(descriereActivitatePreview('alta', 'Descriere reală')).toBe('Descriere reală')
  expect(descriereActivitatePreview('alta', null)).toBeNull()
})

test('activitatea de previzualizare primește descrierea de probă în patru paragrafe', () => {
  const text = descriereActivitatePreview(ID_PREVIEW, 'ignorată')
  expect(text).toContain('Siguranță și îndemânare pe bicicletă.')
  expect(text?.split('\n\n')).toHaveLength(4)
})

test('o activitate obișnuită își păstrează pozele neschimbate', () => {
  const urls = ['https://exemplu.ro/a.jpg']
  expect(pozeActivitatePreview('alta', urls)).toBe(urls)
})

test('activitatea de previzualizare primește poza de probă, o singură dată', () => {
  const urls = ['https://exemplu.ro/a.jpg']
  const cu = pozeActivitatePreview(ID_PREVIEW, urls)
  expect(cu).toEqual(['https://exemplu.ro/a.jpg', '/ui/20210405_152345.webp'])
  expect(urls).toEqual(['https://exemplu.ro/a.jpg'])
  expect(pozeActivitatePreview(ID_PREVIEW, cu)).toEqual(cu)
})
