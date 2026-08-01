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

/**
 * Preenche qualquer campo ausente de `profile` com o shape padrão, sem sobrescrever
 * o que já existe. Usado depois da extração por LLM (que pode retornar shape parcial)
 * e ao carregar de chrome.storage (que pode ter um perfil de uma versão anterior).
 */
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

/**
 * Resolve um profilePath tipo "experiences[0].description" ou "personal.fullName"
 * contra o objeto de perfil. Retorna undefined se o caminho não existir,
 * nunca lança, pra chamar sem try/catch nos pontos de uso.
 */
function resolveProfilePath(profile, path) {
  if (!path) return undefined
  const parts = path.match(/[^.[\]]+/g) ?? []
  return parts.reduce((value, key) => (value == null ? undefined : value[key]), profile)
}

export { emptyProfile, normalizeProfile, resolveProfilePath }
