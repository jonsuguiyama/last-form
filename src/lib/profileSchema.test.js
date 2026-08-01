import { describe, it, expect } from 'vitest'
import { emptyProfile, normalizeProfile, resolveProfilePath } from './profileSchema'

describe('normalizeProfile', () => {
  it('fills in missing top-level sections with empty defaults', () => {
    const normalized = normalizeProfile({ personal: { fullName: 'Jon' } })
    expect(normalized.experiences).toEqual([])
    expect(normalized.personal.fullName).toBe('Jon')
    expect(normalized.personal.email).toBe('')
  })

  it('does not drop existing data when normalizing', () => {
    const profile = {
      personal: { fullName: 'Jon', links: { github: 'jonsuguiyama' } },
      experiences: [{ company: 'Acme' }],
    }
    const normalized = normalizeProfile(profile)
    expect(normalized.personal.links.github).toBe('jonsuguiyama')
    expect(normalized.experiences).toEqual([{ company: 'Acme' }])
  })

  it('returns a fully-shaped empty profile when given nothing', () => {
    expect(normalizeProfile()).toEqual(emptyProfile())
  })
})

describe('resolveProfilePath', () => {
  const profile = normalizeProfile({
    personal: { fullName: 'Jon Suguiyama' },
    experiences: [{ company: 'Acme', description: 'Built things' }],
  })

  it('resolves a nested object path', () => {
    expect(resolveProfilePath(profile, 'personal.fullName')).toBe('Jon Suguiyama')
  })

  it('resolves an array index path', () => {
    expect(resolveProfilePath(profile, 'experiences[0].description')).toBe('Built things')
  })

  it('returns undefined for a path that does not exist, without throwing', () => {
    expect(resolveProfilePath(profile, 'experiences[5].description')).toBeUndefined()
    expect(resolveProfilePath(profile, 'nonsense.path')).toBeUndefined()
  })
})
