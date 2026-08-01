function emptyProfile() {
  return {
    personal: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      links: { linkedin: '', github: '', portfolio: '' },
    },
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    customQA: [],
    fieldBindings: [],
  }
}

function normalizeProfile(profile = {}) {
  const base = emptyProfile()
  return {
    ...base,
    ...profile,
    personal: {
      ...base.personal,
      ...profile.personal,
      links: { ...base.personal.links, ...profile.personal?.links },
    },
    experiences: profile.experiences ?? base.experiences,
    education: profile.education ?? base.education,
    skills: profile.skills ?? base.skills,
    languages: profile.languages ?? base.languages,
    customQA: profile.customQA ?? base.customQA,
    fieldBindings: profile.fieldBindings ?? base.fieldBindings,
  }
}

function resolveProfilePath(profile, path) {
  if (!path) return undefined
  const parts = path.match(/[^.[\]]+/g) ?? []
  return parts.reduce((value, key) => (value == null ? undefined : value[key]), profile)
}

export { emptyProfile, normalizeProfile, resolveProfilePath }
