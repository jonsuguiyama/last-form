import { clickAndWait } from './domWait'
import { findLabel } from './domScanner'

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

function fillField(el, value) {
  if (value == null) return false

  if (el.tagName.toLowerCase() === 'select') return fillSelect(el, value)
  if (el.type === 'checkbox' || el.type === 'radio') return fillCheckable(el, value)

  setNativeValue(el, value)
  return true
}

async function addRepeatableEntries(addButtonEl, count, { scopeEl = document.body } = {}) {
  for (let i = 0; i < count; i += 1) {
    await clickAndWait(addButtonEl, { scopeEl, quietPeriodMs: 300, timeoutMs: 5000 })
  }
}

function fillRadioGroup(radios, value, root = document) {
  if (value == null || radios.length === 0) return false
  const target = String(value).trim().toLowerCase()

  const match =
    radios.find((el) => findLabel(el, root)?.trim().toLowerCase() === target) ??
    radios.find((el) => findLabel(el, root)?.trim().toLowerCase().includes(target))

  if (!match) return false
  if (!match.checked) match.click()
  return true
}

function fillButtonGroup(buttons, value) {
  if (value == null || buttons.length === 0) return false
  const target = String(value).trim().toLowerCase()
  const textOf = (el) => (el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase()

  const match = buttons.find((el) => textOf(el) === target) ?? buttons.find((el) => textOf(el).includes(target))

  if (!match) return false
  match.click()
  return true
}

export { setNativeValue, fillField, addRepeatableEntries, fillRadioGroup, fillButtonGroup }
