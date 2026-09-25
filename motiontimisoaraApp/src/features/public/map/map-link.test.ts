import { expect, test } from 'vitest'

import { linkHartaLoc } from './map-link'

test('harta deschide aplicația aparatului, iar în browser Google Maps', () => {
  expect(linkHartaLoc(45.751, 21.238, 'Parc', 'ios').href).toBe(
    'https://maps.apple.com/?ll=45.751,21.238&q=Parc',
  )
  expect(linkHartaLoc(45.751, 21.238, 'Parc', 'android').href).toBe(
    'geo:45.751,21.238?q=45.751,21.238(Parc)',
  )
  expect(linkHartaLoc(45.751, 21.238, 'Parc', 'web')).toEqual({
    href: 'https://www.google.com/maps/search/?api=1&query=45.751,21.238',
    target: '_blank',
    rel: 'noopener noreferrer',
  })
})
