import { describe, expect, test } from 'vitest'

import {
  articoleCompletate,
  categorieNecesarNoua,
  etichetaArticole,
} from './camp-requirements-form'

describe('camp-requirements-form', () => {
  test('o categorie nouă are un articol gol cu numărul 1', () => {
    expect(categorieNecesarNoua()).toEqual({ name: '', items: [{ name: '', quantity: '1' }] })
  })

  test('numără doar articolele cu nume', () => {
    expect(
      articoleCompletate([
        { name: 'Tricouri', quantity: '5' },
        { name: '  ', quantity: '1' },
        undefined,
      ]),
    ).toBe(1)
    expect(articoleCompletate(undefined)).toBe(0)
  })

  test('acordă eticheta după număr', () => {
    expect(etichetaArticole(0)).toBe('0 articole')
    expect(etichetaArticole(1)).toBe('1 articol')
    expect(etichetaArticole(4)).toBe('4 articole')
    expect(etichetaArticole(19)).toBe('19 articole')
    expect(etichetaArticole(20)).toBe('20 de articole')
    expect(etichetaArticole(101)).toBe('101 articole')
  })
})
