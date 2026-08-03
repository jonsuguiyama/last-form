import { NEXT_STEP_PATTERN, BACK_STEP_PATTERN, SUBMIT_PATTERN } from './wizardNav'
import { ADD_BUTTON_PATTERN } from './dynamicSections'

const FIELD_SELECTOR = 'input, textarea, select'
const COUNTER_PATTERN = /(\d{1,6})\s{0,2}\/\s{0,2}(\d{1,6})/

const EXCLUDED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password'])
const KNOWN_PURPOSE_PATTERNS = [NEXT_STEP_PATTERN, BACK_STEP_PATTERN, SUBMIT_PATTERN, ADD_BUTTON_PATTERN]
const MIN_BUTTON_GROUP_SIZE = 2
const MAX_BUTTON_GROUP_SIZE = 6
const MIN_CHECKBOX_GROUP_SIZE = 2
const MAX_CHECKBOX_GROUP_SIZE = 15

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

function hasVisibleLabel(el, root) {
  const wrapping = el.closest('label')
  if (wrapping && isVisible(wrapping)) return true
  if (el.id) {
    const forLabel = root.querySelector(`label[for="${escapeAttributeValue(el.id)}"]`)
    if (forLabel && isVisible(forLabel)) return true
  }
  return false
}

function isInteractiveField(el, root) {
  if (isVisible(el)) return true
  if (el.type === 'radio' || el.type === 'checkbox') return hasVisibleLabel(el, root)
  return false
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
    labelFromNearbyText(el) ||
    el.getAttribute('placeholder')?.trim() ||
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

function buildFieldDescriptor(el, root) {
  return {
    fieldId: ensureFieldId(el),
    tag: el.tagName.toLowerCase(),
    type: el.type || 'text',
    label: findLabel(el, root),
    name: el.name || null,
    id: el.id || null,
    required: isRequired(el),
    charLimit: findCharLimit(el),
    section: findSection(el),
    options: el.tagName.toLowerCase() === 'select' ? Array.from(el.options).map((o) => o.textContent.trim()) : null,
  }
}

function buildRadioGroupDescriptor(radios, root) {
  const groupId = String(nextFieldId++)
  radios.forEach((el) => {
    el.dataset.japcFieldId = groupId
  })

  const first = radios[0]
  const groupLabel = findSection(first) ?? labelFromNearbyText(first)

  return {
    fieldId: groupId,
    tag: 'radio-group',
    type: 'radio-group',
    label: groupLabel,
    name: first.name || null,
    id: null,
    required: radios.some(isRequired),
    charLimit: null,
    section: findSection(first),
    options: radios.map((el) => findLabel(el, root)).filter(Boolean),
  }
}

function buttonText(el) {
  return (el.textContent || el.getAttribute('aria-label') || '').trim()
}

function hasKnownPurpose(el) {
  const text = buttonText(el)
  return KNOWN_PURPOSE_PATTERNS.some((pattern) => pattern.test(text))
}

function findButtonGroupQuestion(container) {
  const prev = container.previousElementSibling
  const prevText = prev?.textContent?.trim()
  if (prevText && prevText.length < 200) return prevText

  const section = container.closest('fieldset, section, [role="group"]')
  const heading = section?.querySelector('legend, h1, h2, h3, h4, label, p')
  const headingText = heading?.textContent?.trim()
  return headingText && headingText.length < 200 ? headingText : null
}

function findButtonChoiceGroups(root) {
  const candidates = Array.from(root.querySelectorAll('form button'))
    .filter((el) => !el.disabled)
    .filter((el) => el.dataset.japcFilled !== 'true')
    .filter(isVisible)
    .filter((el) => buttonText(el).length > 0)
    .filter((el) => !hasKnownPurpose(el))

  const byParent = new Map()
  for (const el of candidates) {
    const parent = el.parentElement
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(el)
  }

  return [...byParent.entries()]
    .filter(([, buttons]) => buttons.length >= MIN_BUTTON_GROUP_SIZE && buttons.length <= MAX_BUTTON_GROUP_SIZE)
    .map(([parent, buttons]) => ({ parent, buttons }))
}

function buildButtonGroupDescriptor(parent, buttons) {
  const groupId = String(nextFieldId++)
  buttons.forEach((el) => {
    el.dataset.japcFieldId = groupId
  })

  return {
    fieldId: groupId,
    tag: 'button-group',
    type: 'button-group',
    label: findButtonGroupQuestion(parent),
    name: null,
    id: null,
    required: false,
    charLimit: null,
    section: findSection(parent),
    options: buttons.map(buttonText).filter(Boolean),
  }
}

function checkboxGroupContainer(el) {
  const semantic = el.closest('fieldset, section, [role="group"], ul, ol')
  if (semantic) return semantic

  const parent = el.parentElement
  if (parent?.tagName.toLowerCase() === 'label') return parent.parentElement ?? parent
  return parent
}

function findCheckboxGroups(checkboxes) {
  const byContainer = new Map()
  for (const el of checkboxes) {
    const container = checkboxGroupContainer(el)
    if (!byContainer.has(container)) byContainer.set(container, [])
    byContainer.get(container).push(el)
  }

  return [...byContainer.entries()]
    .filter(([, boxes]) => boxes.length >= MIN_CHECKBOX_GROUP_SIZE && boxes.length <= MAX_CHECKBOX_GROUP_SIZE)
    .map(([container, boxes]) => ({ container, boxes }))
}

function buildCheckboxGroupDescriptor(container, boxes, root) {
  const groupId = String(nextFieldId++)
  boxes.forEach((el) => {
    el.dataset.japcFieldId = groupId
  })

  return {
    fieldId: groupId,
    tag: 'checkbox-group',
    type: 'checkbox-group',
    label: findButtonGroupQuestion(container) ?? findSection(boxes[0]),
    name: null,
    id: null,
    required: boxes.some(isRequired),
    charLimit: null,
    section: findSection(boxes[0]),
    options: boxes.map((el) => findLabel(el, root)).filter(Boolean),
  }
}

const DIALOG_SELECTOR = '[role="dialog"], [aria-modal="true"]'

function resolveScanRoot(root) {
  if (typeof root.querySelectorAll !== 'function') return root

  const dialogs = Array.from(root.querySelectorAll(DIALOG_SELECTOR)).filter(isVisible)
  if (dialogs.length === 0) return root

  return dialogs.at(-1)
}

function scanFields(root = document) {
  resetFieldIds()
  const scanRoot = resolveScanRoot(root)
  const elements = Array.from(scanRoot.querySelectorAll(FIELD_SELECTOR))
    .filter((el) => !EXCLUDED_INPUT_TYPES.has(el.type))
    .filter((el) => !el.disabled)
    .filter((el) => el.dataset.japcFilled !== 'true')
    .filter((el) => isInteractiveField(el, scanRoot))

  const radioGroups = new Map()
  const checkboxCandidates = []
  const singles = []

  for (const el of elements) {
    if (el.type === 'radio' && el.name) {
      if (!radioGroups.has(el.name)) radioGroups.set(el.name, [])
      radioGroups.get(el.name).push(el)
    } else if (el.type === 'checkbox') {
      checkboxCandidates.push(el)
    } else {
      singles.push(el)
    }
  }

  const checkboxGroups = findCheckboxGroups(checkboxCandidates)
  const groupedCheckboxes = new Set(checkboxGroups.flatMap(({ boxes }) => boxes))
  const ungroupedCheckboxes = checkboxCandidates.filter((el) => !groupedCheckboxes.has(el))

  const radioGroupDescriptors = [...radioGroups.values()].map((radios) =>
    buildRadioGroupDescriptor(radios, scanRoot),
  )
  const buttonGroupDescriptors = findButtonChoiceGroups(scanRoot).map(({ parent, buttons }) =>
    buildButtonGroupDescriptor(parent, buttons),
  )
  const checkboxGroupDescriptors = checkboxGroups.map(({ container, boxes }) =>
    buildCheckboxGroupDescriptor(container, boxes, scanRoot),
  )
  const singleDescriptors = [...singles, ...ungroupedCheckboxes].map((el) => buildFieldDescriptor(el, scanRoot))

  return [...radioGroupDescriptors, ...buttonGroupDescriptors, ...checkboxGroupDescriptors, ...singleDescriptors]
}

function getFieldElement(fieldId, root = document) {
  return root.querySelector(`[data-japc-field-id="${fieldId}"]`)
}

function getFieldElements(fieldId, root = document) {
  return Array.from(root.querySelectorAll(`[data-japc-field-id="${fieldId}"]`))
}

export { scanFields, getFieldElement, getFieldElements, findLabel, findCharLimit, isRequired }
