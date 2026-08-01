const ADD_BUTTON_PATTERN = /(^\+$|adicionar|add\b)/i

const SECTION_PATTERNS = {
  experiences: /experi[eê]ncia|employment|work history/i,
  education: /educa[cç][aã]o|forma[cç][aã]o|education/i,
}

function isAddButton(el) {
  const tag = el.tagName.toLowerCase()
  if (tag !== 'button' && tag !== 'a') return false
  const text = (el.textContent || el.getAttribute('aria-label') || '').trim()
  return ADD_BUTTON_PATTERN.test(text)
}

function nearestHeadingText(el) {
  const container = el.closest('section, fieldset, div')
  if (!container) return ''
  const heading = container.querySelector('h1, h2, h3, h4, legend')
  return heading ? heading.textContent : container.textContent.slice(0, 200)
}

/**
 * Encontra botões de "+ Adicionar" e tenta associá-los a uma seção conhecida
 * (experiências, educação) pelo texto do heading mais próximo. Heurística - alvo
 * de ajuste conforme exemplos reais forem chegando (ver plano, "Coleta de exemplos
 * reais").
 */
function findAddButtonsBySection(root = document) {
  const buttons = Array.from(root.querySelectorAll('button, a')).filter(isAddButton)
  const bySection = {}

  for (const button of buttons) {
    const nearbyText = nearestHeadingText(button)
    for (const [section, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(nearbyText) && !bySection[section]) {
        bySection[section] = button
      }
    }
  }

  return bySection
}

export { findAddButtonsBySection }
