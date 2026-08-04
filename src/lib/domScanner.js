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
const MIN_DEDUPE_LENGTH = 8

// Form builders often render a question as a heading that is a sibling of the DIV wrapping the
// field, not of the field itself, so we have to climb a couple of levels to find it. Kept short on
// purpose: the further up we go, the more likely we are to grab a section heading shared by many
// fields instead of this field's own question.
const MAX_QUESTION_BLOCK_LEVELS = 3
const QUESTION_BLOCK_BOUNDARY = 'form, fieldset, section, [role="group"], [role="dialog"], body'
// No h1 on purpose: an h1 is the page/form title, never a single field's question.
const QUESTION_BLOCK_TEXT_SELECTOR = 'label, legend, p, span, h2, h3, h4, h5, h6'
const MAX_QUESTION_LENGTH = 300

// A name/id is only readable as a question when it looks like a sentence. Technical names
// ("email", "firstName", "user_phone") never contain a space, which is the cheapest reliable guard.
const MIN_NAME_AS_LABEL_LENGTH = 12

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

function dedupeRepeatedText(text) {
  if (!text) return text
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length < MIN_DEDUPE_LENGTH) return text

  const half = normalized.length / 2
  if (Number.isInteger(half) && normalized.slice(0, half) === normalized.slice(half)) {
    return normalized.slice(0, half)
  }

  const oddHalf = (normalized.length - 1) / 2
  if (Number.isInteger(oddHalf)) {
    const separator = normalized[oddHalf]
    const isSeparator = separator === ' ' || separator === '\n' || separator === '\t'
    if (isSeparator && normalized.slice(0, oddHalf) === normalized.slice(oddHalf + 1)) {
      return normalized.slice(0, oddHalf)
    }
  }

  return text
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
  return labelFromQuestionBlock(el)
}

function precedesField(candidate, el) {
  if (candidate.contains(el)) return false
  return Boolean(el.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_PRECEDING)
}

// Heading markup carries decoration the question itself does not: a required-marker asterisk in its
// own <strong>, and leftovers of CSS-rendered numbering (a bare "." before the text). Required-ness
// is already reported by isRequired(), so keeping the asterisk here only garbles the label.
function cleanQuestionText(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s?\*$/, '')
    .replace(/^[^\p{L}\p{N}([]+/u, '')
    .trim()
}

// A "question block" is a wrapper holding one question and the single field that answers it. The
// question is often a heading next to the DIV that wraps the field, so it is invisible both to
// previousElementSibling and to a lookup inside the field's immediate parent.
function labelFromQuestionBlock(el) {
  let container = el.parentElement?.parentElement

  for (let level = 0; container && level < MAX_QUESTION_BLOCK_LEVELS; level++) {
    // Sections are findSection's job: their heading describes a group, not this one field.
    if (container.matches(QUESTION_BLOCK_BOUNDARY)) return null
    if (container.querySelectorAll(FIELD_SELECTOR).length > 1) return null

    const candidate = Array.from(container.querySelectorAll(QUESTION_BLOCK_TEXT_SELECTOR)).find((node) =>
      precedesField(node, el),
    )
    const text = candidate ? cleanQuestionText(candidate.textContent) : ''
    if (text && text.length <= MAX_QUESTION_LENGTH) return text

    container = container.parentElement
  }
  return null
}

// Last resort before giving up. Every field needs SOMETHING that tells it apart from its neighbours,
// and name/id are the closest thing to guaranteed-unique on a form (it needs them to submit at all).
// Some builders name the field after the question itself, which is exactly the text we want.
function labelFromFieldName(el) {
  for (const candidate of [el.name, el.id]) {
    const value = candidate?.trim()
    if (!value) continue
    if (value.length < MIN_NAME_AS_LABEL_LENGTH || value.length > MAX_QUESTION_LENGTH) continue
    // A technical name ("email", "firstName", "answers[0]") never reads like a sentence.
    if (!/\s/.test(value) || /[[\]{}]/.test(value)) continue
    return cleanQuestionText(value)
  }
  return null
}

// Deliberately no placeholder fallback: placeholder is hint text shown inside the empty input, and
// it is the one source guaranteed to be IDENTICAL across every field of a form ("Digite sua resposta
// aqui"), so using it as a label both misstates the question and makes fields indistinguishable.
// No label at all is more honest than the same wrong label on every field.
function findLabel(el, root) {
  const label =
    labelFromFor(el, root) ||
    labelFromWrapping(el) ||
    labelFromAria(el) ||
    labelFromNearbyText(el) ||
    labelFromFieldName(el) ||
    null
  return dedupeRepeatedText(label)
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
  return heading ? dedupeRepeatedText(heading.textContent.trim()) : null
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
  const prevText = prev ? cleanQuestionText(prev.textContent) : ''
  if (prevText && prevText.length < 200) return dedupeRepeatedText(prevText)

  const section = container.closest('fieldset, section, [role="group"]')
  const heading = section?.querySelector('legend, h1, h2, h3, h4, label, p')
  const headingText = heading ? cleanQuestionText(heading.textContent) : ''
  return headingText && headingText.length < 200 ? dedupeRepeatedText(headingText) : null
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

  // closest() instead of parentElement: UI kits wrap the native input in one or more spans (icon,
  // ripple, state layer) before the <label>, so the label is rarely the immediate parent. Missing it
  // gave every checkbox its own container, so no group ever reached MIN_CHECKBOX_GROUP_SIZE and the
  // whole question came out as N unrelated single-checkbox fields.
  const wrappingLabel = el.closest('label')
  if (wrappingLabel) return wrappingLabel.parentElement ?? wrappingLabel
  return el.parentElement
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

function isTopFrameBehindAModal() {
  if (window.self !== window.top) return false
  if (document.querySelectorAll('iframe').length === 0) return false
  return window.getComputedStyle(document.body).overflow === 'hidden'
}

function resolveScanRoot(root) {
  if (typeof root.querySelectorAll !== 'function') return root

  const dialogs = Array.from(root.querySelectorAll(DIALOG_SELECTOR)).filter(isVisible)
  if (dialogs.length > 0) return dialogs.at(-1)

  if (root === document && isTopFrameBehindAModal()) return null

  return root
}

function scanFields(root = document) {
  resetFieldIds()
  const scanRoot = resolveScanRoot(root)
  if (scanRoot == null) return []

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

  const radioGroupEntries = [...radioGroups.values()].map((radios) => ({
    anchor: radios[0],
    descriptor: buildRadioGroupDescriptor(radios, scanRoot),
  }))
  const buttonGroupEntries = findButtonChoiceGroups(scanRoot).map(({ parent, buttons }) => ({
    anchor: buttons[0],
    descriptor: buildButtonGroupDescriptor(parent, buttons),
  }))
  const checkboxGroupEntries = checkboxGroups.map(({ container, boxes }) => ({
    anchor: boxes[0],
    descriptor: buildCheckboxGroupDescriptor(container, boxes, scanRoot),
  }))
  const singleEntries = [...singles, ...ungroupedCheckboxes].map((el) => ({
    anchor: el,
    descriptor: buildFieldDescriptor(el, scanRoot),
  }))

  // Previously concatenated by type, which put every checkbox-group ahead of plain fields
  // regardless of page position. Sort by real DOM position instead, so the list always matches
  // the order fields appear on the page.
  const entries = [...radioGroupEntries, ...buttonGroupEntries, ...checkboxGroupEntries, ...singleEntries]
  entries.sort((a, b) => {
    const position = a.anchor.compareDocumentPosition(b.anchor)
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
    return 0
  })

  return entries.map((entry) => entry.descriptor)
}

function getFieldElement(fieldId, root = document) {
  return root.querySelector(`[data-japc-field-id="${fieldId}"]`)
}

function getFieldElements(fieldId, root = document) {
  return Array.from(root.querySelectorAll(`[data-japc-field-id="${fieldId}"]`))
}

export { scanFields, getFieldElement, getFieldElements, findLabel, findCharLimit, isRequired }
