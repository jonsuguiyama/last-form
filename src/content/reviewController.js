import { scanFields, getFieldElement, getFieldElements } from '../lib/domScanner'
import { fillField, fillRadioGroup, fillButtonGroup, fillCheckboxGroup, addRepeatableEntries } from '../lib/fillEngine'
import { findAddButtonsBySection } from '../lib/dynamicSections'
import { findNextStepButton } from '../lib/wizardNav'
import { sendMessage, MESSAGE_TYPES } from '../lib/messaging'

const DESCRIPTION_SELECTOR = '[class*="description" i], [id*="description" i], main, article'

function extractJobDescription() {
  const text = document.querySelector(DESCRIPTION_SELECTOR)?.textContent?.trim()
  return text && text.length > 40 ? text.slice(0, 4000) : null
}

async function analyzeFields(fields, { extraContext } = {}) {
  if (fields.length === 0) return []

  const jobDescription = extractJobDescription()
  const mappings = await sendMessage(MESSAGE_TYPES.MAP_FIELDS, { fields, jobDescription, extraContext })
  const byId = new Map(mappings.map((m) => [m.fieldId, m]))

  return Promise.all(
    fields.map(async (field) => {
      const mapping = byId.get(field.fieldId) ?? {
        value: null,
        confidence: 0,
        missingQuestion: 'Não foi possível mapear este campo automaticamente.',
      }

      let { value } = mapping
      if (value && field.charLimit && value.length > field.charLimit.max) {
        value = await sendMessage(MESSAGE_TYPES.ADAPT_TEXT, {
          sourceText: value,
          maxLength: field.charLimit.max,
          jobDescription,
        })
      }

      return { ...field, proposal: { ...mapping, value } }
    }),
  )
}

async function analyzeCurrentStep(root = document) {
  const fields = scanFields(root)
  const enriched = await analyzeFields(fields)
  return { fields: enriched, addButtons: findAddButtonsBySection(root) }
}

async function expandSection(buttonEl, count, profileArrayKey, root = document) {
  const before = new Set(scanFields(root).map((f) => f.fieldId))
  const newFieldsByEntry = []

  for (let i = 0; i < count; i += 1) {
    await addRepeatableEntries(buttonEl, 1, { scopeEl: document.body })
    const afterFields = scanFields(root)
    const newFields = afterFields.filter((f) => !before.has(f.fieldId))
    newFields.forEach((f) => before.add(f.fieldId))

    if (newFields.length === 0) continue

    const enriched = await analyzeFields(newFields, {
      extraContext: `Estes campos pertencem à entrada de índice ${i} de profile.${profileArrayKey}. Use somente dados dessa entrada.`,
    })
    newFieldsByEntry.push(...enriched)
  }

  return newFieldsByEntry
}

function applyGroupField(field, root, fillGroup) {
  const els = getFieldElements(field.fieldId, root)
  if (els.length === 0) return { fieldId: field.fieldId, applied: false }

  const applied = fillGroup(els, field.userValue, root)
  if (applied) els.forEach((el) => (el.dataset.japcFilled = 'true'))
  return { fieldId: field.fieldId, applied }
}

function applySingleField(field, root) {
  const el = getFieldElement(field.fieldId, root)
  if (!el) return { fieldId: field.fieldId, applied: false }

  const applied = fillField(el, field.userValue)
  if (applied) el.dataset.japcFilled = 'true'
  return { fieldId: field.fieldId, applied }
}

function isEmptyValue(value) {
  if (Array.isArray(value)) return value.length === 0
  return value == null || value === ''
}

function applyFields(fields, root = document) {
  return fields.map((field) => {
    if (isEmptyValue(field.userValue)) return { fieldId: field.fieldId, applied: false }
    if (field.tag === 'radio-group') return applyGroupField(field, root, fillRadioGroup)
    if (field.tag === 'button-group') return applyGroupField(field, root, fillButtonGroup)
    if (field.tag === 'checkbox-group') return applyGroupField(field, root, fillCheckboxGroup)
    return applySingleField(field, root)
  })
}

function hasBlockingRequiredField(fields) {
  return fields.some((field) => field.required && isEmptyValue(field.userValue))
}

function findNextStep(root = document) {
  return findNextStepButton(root)
}

export { analyzeCurrentStep, expandSection, applyFields, hasBlockingRequiredField, findNextStep }
