const FIELD_SELECTOR = 'input, textarea, select'
const COUNTER_PATTERN = /(\d{1,6})\s{0,2}\/\s{0,2}(\d{1,6})/

const EXCLUDED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image'])

let nextFieldId = 0

function resetFieldIds() {
  nextFieldId = 0
}

function isVisible(el) {
  if (el.hidden) return false
  const style = window.getComputedStyle(el)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

function escapeAttributeValue(value) {
  return value.replace(/["\\]/g, String.raw`\$&`)
}

function labelFromFor(el, root) {
  if (!el.id) return null
  const label = root.querySelector(`label[for="${escapeAttributeValue(el.id)}"]`)
  return label ? label.textContent.trim() : null
}

function labelFromWrapping(el) {
  const label = el.closest('label')
  if (!label) return null
  return label.textContent.trim()
}

function labelFromAria(el) {
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel.trim()

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const ref = document.getElementById(labelledBy)
    if (ref) return ref.textContent.trim()
  }
  return null
}

function labelFromNearbyText(el) {
  const prev = el.previousElementSibling
  const prevText = prev?.textContent.trim()
  if (prevText && !FIELD_SELECTOR.split(', ').includes(prev.tagName.toLowerCase())) {
    return prevText
  }
  const heading = el.parentElement?.querySelector('label, span, p, legend')
  const headingText = heading?.textContent.trim()
  if (headingText) return headingText
  return null
}

function findLabel(el, root) {
  return (
    labelFromFor(el, root) ||
    labelFromWrapping(el) ||
    labelFromAria(el) ||
    el.getAttribute('placeholder')?.trim() ||
    labelFromNearbyText(el) ||
    null
  )
}

function findCharLimit(el) {
  const maxLength = el.getAttribute('maxlength')
  if (maxLength && Number(maxLength) > 0) {
    return { max: Number(maxLength), source: 'attribute' }
  }

  const container = el.closest('div, fieldset, li') || el.parentElement
  if (!container) return null

  const match = container.textContent.match(COUNTER_PATTERN)
  if (match) {
    return { max: Number(match[2]), source: 'counter-text' }
  }
  return null
}

function findSection(el) {
  const container = el.closest('fieldset, section, [role="group"]')
  if (!container) return null
  const heading = container.querySelector('legend, h1, h2, h3, h4')
  return heading ? heading.textContent.trim() : null
}

function isRequired(el) {
  if (el.required) return true
  if (el.getAttribute('aria-required') === 'true') return true
  const container = el.closest('div, fieldset, li') || el.parentElement
  if (container && /\*/.test(container.textContent.slice(0, 200))) return true
  return false
}

function ensureFieldId(el) {
  if (!el.dataset.japcFieldId) {
    el.dataset.japcFieldId = String(nextFieldId++)
  }
  return el.dataset.japcFieldId
}

function scanFields(root = document) {
  resetFieldIds()
  const elements = Array.from(root.querySelectorAll(FIELD_SELECTOR))

  return elements
    .filter((el) => !EXCLUDED_INPUT_TYPES.has(el.type))
    .filter((el) => !el.disabled)
    .filter((el) => el.dataset.japcFilled !== 'true')
    .filter(isVisible)
    .map((el) => ({
      fieldId: ensureFieldId(el),
      tag: el.tagName.toLowerCase(),
      type: el.type || 'text',
      label: findLabel(el, root),
      name: el.name || null,
      id: el.id || null,
      required: isRequired(el),
      charLimit: findCharLimit(el),
      section: findSection(el),
      currentValue: el.value || null,
      options:
        el.tagName.toLowerCase() === 'select'
          ? Array.from(el.options).map((o) => o.textContent.trim())
          : null,
    }))
}

function getFieldElement(fieldId, root = document) {
  return root.querySelector(`[data-japc-field-id="${fieldId}"]`)
}

export { scanFields, getFieldElement, findLabel, findCharLimit, isRequired }
