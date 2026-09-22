import { campRulesForDisplay, campRulesForSave, campRulesFileContentType, formatCampRulesFileSize, respingeRegulamentFisier } from './camp-rules'

test('blank camp rules are stored as null', () => {
  expect(campRulesForSave('')).toBeNull()
  expect(campRulesForSave('   \n  ')).toBeNull()
})

test('camp rules keep inner line breaks after trimming the edges', () => {
  expect(campRulesForSave('  Fără telefoane.\nFără dulciuri.  ')).toBe(
    'Fără telefoane.\nFără dulciuri.',
  )
  expect(campRulesForDisplay('  Fără telefoane.\nFără dulciuri.  ')).toBe(
    'Fără telefoane.\nFără dulciuri.',
  )
  expect(campRulesForDisplay(null)).toBeNull()
})

test('PDF, Word, Excel and images are accepted; video is not', () => {
  expect(campRulesFileContentType({ name: 'r.pdf', type: 'application/pdf' })).toBe('application/pdf')
  expect(campRulesFileContentType({ name: 'r.docx', type: '' })).toBe(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  expect(campRulesFileContentType({ name: 'r.xlsx', type: 'application/octet-stream' })).toBe(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  expect(campRulesFileContentType({ name: 'r.png', type: 'image/png' })).toBe('image/png')
  expect(campRulesFileContentType({ name: 'clip.mp4', type: 'video/mp4' })).toBeNull()
})

test('type and size rejections are named for the organizer', () => {
  expect(respingeRegulamentFisier({ name: 'clip.mp4', type: 'video/mp4', size: 12 })).toMatch(
    /PDF, imagine, Word sau Excel/,
  )
  expect(
    respingeRegulamentFisier({ name: 'r.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 }),
  ).toMatch(/10 MB/)
  expect(respingeRegulamentFisier({ name: 'r.pdf', type: 'application/pdf', size: 0 })).toMatch(/gol/)
})

test('file size uses the Romanian decimal comma', () => {
  expect(formatCampRulesFileSize(1200)).toBe('1,2 KB')
  expect(formatCampRulesFileSize(10 * 1024 * 1024)).toBe('10 MB')
})
