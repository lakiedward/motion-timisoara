import { MESAJ_POZA_HERO, mesajHeroLipsa } from './hero-photo'

const fisier = new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })

test('fără fișier și fără poză salvată, salvarea e oprită', () => {
  expect(mesajHeroLipsa(null, null)).toBe(MESAJ_POZA_HERO)
})

test('un fișier ales sau o poză deja salvată lasă salvarea să continue', () => {
  expect(mesajHeroLipsa(fisier, null)).toBeNull()
  expect(mesajHeroLipsa(null, 'id/hero/a.jpg')).toBeNull()
})
