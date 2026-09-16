import { campRulesForDisplay, campRulesForSave } from './camp-rules'

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
