import { MESSAGE_TYPES } from '../lib/messaging'
import { getProfile, saveProfile, getApiKey, saveApiKey } from '../lib/storage'
import { mapFields, adaptText, parseResume, verifyApiKey } from '../lib/geminiClient'
import { findFieldBinding, findCustomQA } from '../lib/fieldBindings'

/**
 * Antes de gastar uma chamada ao Gemini, resolve localmente o que já tem
 * fieldBinding/customQA salvo (ver plano: "fieldBindings tem prioridade sobre o LLM").
 * Retorna os já resolvidos e o que ainda precisa ir pro LLM.
 */
function resolveLocallyKnownFields(profile, fields) {
  const resolved = []
  const remaining = []

  for (const field of fields) {
    const binding = findFieldBinding(profile, field.label) ?? findCustomQA(profile, field.label)
    if (binding) {
      resolved.push({ fieldId: field.fieldId, value: binding.value, confidence: 1, source: binding.source })
    } else {
      remaining.push(field)
    }
  }

  return { resolved, remaining }
}

async function handleMapFields({ fields, jobDescription, extraContext }) {
  const [profile, apiKey] = await Promise.all([getProfile(), getApiKey()])
  const { resolved, remaining } = resolveLocallyKnownFields(profile, fields)

  const llmMappings = remaining.length
    ? await mapFields({ apiKey, profile, fields: remaining, jobDescription, extraContext })
    : []

  return [...resolved, ...llmMappings.map((m) => ({ ...m, source: 'llm' }))]
}

async function handleAdaptText({ sourceText, maxLength, jobDescription }) {
  const apiKey = await getApiKey()
  return adaptText({ apiKey, sourceText, maxLength, jobDescription })
}

async function handleParseResume({ pdfBase64 }) {
  const apiKey = await getApiKey()
  return parseResume({ apiKey, pdfBase64 })
}

const handlers = {
  [MESSAGE_TYPES.MAP_FIELDS]: (payload) => handleMapFields(payload),
  [MESSAGE_TYPES.ADAPT_TEXT]: (payload) => handleAdaptText(payload),
  [MESSAGE_TYPES.PARSE_RESUME]: (payload) => handleParseResume(payload),
  [MESSAGE_TYPES.GET_PROFILE]: () => getProfile(),
  [MESSAGE_TYPES.SAVE_PROFILE]: (payload) => saveProfile(payload),
  [MESSAGE_TYPES.GET_API_KEY]: () => getApiKey(),
  [MESSAGE_TYPES.SAVE_API_KEY]: (payload) => saveApiKey(payload),
  [MESSAGE_TYPES.VERIFY_API_KEY]: (apiKey) => verifyApiKey({ apiKey }),
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = handlers[message?.type]
  if (!handler) return false

  handler(message.payload)
    .then((result) => sendResponse({ result }))
    .catch((error) => sendResponse({ error: error.message }))

  return true // mantém o canal aberto pra resposta assíncrona
})
