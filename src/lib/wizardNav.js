const NEXT_STEP_PATTERN = /\b(pr[oó]xim[oa]|continuar|avan[cç]ar|next|continue)\b/i
const BACK_STEP_PATTERN = /\b(voltar|anterior|back|previous)\b/i
const SUBMIT_PATTERN = /\b(enviar|finalizar|submit|apply|candidatar)\b/i

function isNavButton(el) {
  const tag = el.tagName.toLowerCase()
  if (tag !== 'button' && !(tag === 'input' && ['submit', 'button'].includes(el.type)) && tag !== 'a') {
    return false
  }
  return true
}

function textOf(el) {
  return (el.value || el.textContent || el.getAttribute('aria-label') || '').trim()
}

function findNextStepButton(root = document) {
  const candidates = Array.from(root.querySelectorAll('button, a, input[type="submit"], input[type="button"]'))
    .filter(isNavButton)
    .filter((el) => !el.disabled)

  return (
    candidates.find((el) => {
      const text = textOf(el)
      return NEXT_STEP_PATTERN.test(text) && !BACK_STEP_PATTERN.test(text) && !SUBMIT_PATTERN.test(text)
    }) ?? null
  )
}

function looksLikeSubmitButton(el) {
  return SUBMIT_PATTERN.test(textOf(el))
}

export { findNextStepButton, looksLikeSubmitButton }
