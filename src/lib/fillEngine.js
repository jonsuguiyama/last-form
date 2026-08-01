import { clickAndWait } from './domWait'

/**
 * Escreve num input/textarea usando o setter nativo do prototype, não `el.value = x`.
 * Necessário porque React/Vue guardam o valor no próprio estado do framework - só
 * disparar 'input' depois de um `el.value = x` direto não é suficiente, porque o
 * framework ignora a mudança (o setter da instância foi sobrescrito pelo framework).
 */
function setNativeValue(el, value) {
  const prototype = Object.getPrototypeOf(el)
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor.set.call(el, value)

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function fillSelect(el, value) {
  const option = Array.from(el.options).find(
    (o) => o.textContent.trim().toLowerCase() === String(value).trim().toLowerCase(),
  )
  if (!option) return false
  el.value = option.value
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function fillCheckable(el, value) {
  const shouldCheck = value === true || String(value).toLowerCase() === 'true'
  if (el.checked === shouldCheck) return true
  el.click()
  return true
}

/**
 * Preenche um único elemento de formulário de acordo com seu tipo. Retorna
 * true/false indicando sucesso, pra quem chama decidir se reporta erro.
 */
function fillField(el, value) {
  if (value == null) return false

  if (el.tagName.toLowerCase() === 'select') return fillSelect(el, value)
  if (el.type === 'checkbox' || el.type === 'radio') return fillCheckable(el, value)

  setNativeValue(el, value)
  return true
}

/**
 * Clica no botão "+ Adicionar" `count` vezes (uma por entrada que falta no perfil),
 * esperando o DOM estabilizar entre cliques - necessário pra seções dinâmicas tipo
 * "Experiência"/"Educação" que só existem depois do clique.
 */
async function addRepeatableEntries(addButtonEl, count, { scopeEl = document.body } = {}) {
  for (let i = 0; i < count; i += 1) {
    await clickAndWait(addButtonEl, { scopeEl, quietPeriodMs: 300, timeoutMs: 5000 })
  }
}

export { setNativeValue, fillField, addRepeatableEntries }
