import { resolveProfilePath } from './profileSchema'

function normalizeLabel(label) {
  return (label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas de combinação Unicode)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordSet(label) {
  return new Set(normalizeLabel(label).split(' ').filter(Boolean))
}

function similarity(labelA, labelB) {
  const a = wordSet(labelA)
  const b = wordSet(labelB)
  if (a.size === 0 || b.size === 0) return 0
  const intersection = [...a].filter((word) => b.has(word)).length
  const union = new Set([...a, ...b]).size
  return intersection / union
}

const MATCH_THRESHOLD = 0.6

function bestMatch(label, candidates, getPattern) {
  let best = null
  let bestScore = 0
  for (const candidate of candidates) {
    const pattern = getPattern(candidate)
    const exact = normalizeLabel(pattern) === normalizeLabel(label)
    const score = exact ? 1 : similarity(label, pattern)
    if (score > bestScore && score >= MATCH_THRESHOLD) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

/**
 * Se o label de um campo bate com um fieldBinding salvo, resolve o valor direto do
 * perfil - sem chamar o LLM. Tem prioridade sobre o mapeamento por IA (ver plano,
 * seção "Decisões de arquitetura importantes").
 */
function findFieldBinding(profile, label) {
  const match = bestMatch(label, profile.fieldBindings ?? [], (b) => b.labelPattern)
  if (!match) return null
  const value = resolveProfilePath(profile, match.profilePath)
  if (value == null || value === '') return null
  return { source: 'fieldBinding', profilePath: match.profilePath, value }
}

/**
 * Mesma ideia, mas pra perguntas livres (customQA) que não apontam pra um campo
 * estruturado do perfil - ex: "Você tem CNH categoria B?".
 */
function findCustomQA(profile, label) {
  const match = bestMatch(label, profile.customQA ?? [], (qa) => qa.questionPattern)
  if (!match) return null
  return { source: 'customQA', questionPattern: match.questionPattern, value: match.answer }
}

export { normalizeLabel, similarity, findFieldBinding, findCustomQA }
