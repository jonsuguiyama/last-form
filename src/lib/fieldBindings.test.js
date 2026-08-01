import { describe, it, expect } from 'vitest'
import { normalizeLabel, findFieldBinding, findCustomQA } from './fieldBindings'
import { normalizeProfile } from './profileSchema'

describe('normalizeLabel', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeLabel('Maior Conquista?!')).toBe('maior conquista')
    expect(normalizeLabel('Nível de Inglês')).toBe('nivel de ingles')
  })
})

describe('findFieldBinding', () => {
  const profile = normalizeProfile({
    experiences: [{ company: 'Acme', description: 'Liderei o time de pagamentos' }],
    fieldBindings: [{ labelPattern: 'Maior conquista profissional', profilePath: 'experiences[0].description' }],
  })

  it('resolves the profile value when the label closely matches a saved binding', () => {
    const match = findFieldBinding(profile, 'Qual sua maior conquista profissional?')
    expect(match).toEqual({
      source: 'fieldBinding',
      profilePath: 'experiences[0].description',
      value: 'Liderei o time de pagamentos',
    })
  })

  it('returns null when nothing matches closely enough', () => {
    expect(findFieldBinding(profile, 'Pretensão salarial')).toBeNull()
  })

  it('returns null when the bound profile path resolves to nothing', () => {
    const emptyBindingProfile = normalizeProfile({
      fieldBindings: [{ labelPattern: 'Maior conquista', profilePath: 'experiences[0].description' }],
    })
    expect(findFieldBinding(emptyBindingProfile, 'Maior conquista')).toBeNull()
  })
})

describe('findCustomQA', () => {
  const profile = normalizeProfile({
    customQA: [{ questionPattern: 'Você possui CNH categoria B?', answer: 'Sim' }],
  })

  it('finds a learned answer for a similar question', () => {
    expect(findCustomQA(profile, 'Possui CNH categoria B?')).toEqual({
      source: 'customQA',
      questionPattern: 'Você possui CNH categoria B?',
      value: 'Sim',
    })
  })

  it('returns null for an unrelated question', () => {
    expect(findCustomQA(profile, 'Disponibilidade para viajar?')).toBeNull()
  })
})
