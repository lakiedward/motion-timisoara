import { citesteComponentePret } from './camp-age-components'

test('citește doar componentele cu nume și sumă întreagă', () => {
  expect(citesteComponentePret(null)).toEqual([])
  expect(
    citesteComponentePret([
      { name: ' Cazare ', amount: 40000 },
      { name: '', amount: 1 },
      { name: 'Masă', amount: 20000 },
      { name: 'Fracție', amount: 1.5 },
    ]),
  ).toEqual([
    { name: 'Cazare', amount: 40000 },
    { name: 'Masă', amount: 20000 },
  ])
})
