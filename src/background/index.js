import { MESSAGE_TYPES } from '../lib/messaging'
import { getProfile, saveProfile, getApiKey, saveApiKey } from '../lib/storage'
import { mapFields, adaptText, parseResume, verifyApiKey } from '../lib/geminiClient'
import { findFieldBinding, findCustomQA } from '../lib/fieldBindings'
import { enqueueGeminiCall } from './geminiQueue'

function queueProgress(onProgress) {
  return (position, total) => {
    if (total > 1) onProgress?.({ type: 'queue', position, total })
  }
}

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

async function handleMapFields({ fields, jobDescription, extraContext }, onProgress) {
  const [profile, apiKey] = await Promise.all([getProfile(), getApiKey()])
  const { resolved, remaining } = resolveLocallyKnownFields(profile, fields)

  const llmMappings = remaining.length
    ? await enqueueGeminiCall(
        () => mapFields({ apiKey, profile, fields: remaining, jobDescription, extraContext }),
        queueProgress(onProgress),
      )
    : []

  return [...resolved, ...llmMappings.map((m) => ({ ...m, source: 'llm' }))]
}

async function handleAdaptText({ sourceText, maxLength, jobDescription }, onProgress) {
  const apiKey = await getApiKey()
  return enqueueGeminiCall(
    () => adaptText({ apiKey, sourceText, maxLength, jobDescription }),
    queueProgress(onProgress),
  )
}

async function handleParseResume({ resumeText }, onProgress) {
  const apiKey = await getApiKey()
  return enqueueGeminiCall(() => parseResume({ apiKey, resumeText }), queueProgress(onProgress))
}

const handlers = {
  [MESSAGE_TYPES.MAP_FIELDS]: (payload, onProgress) => handleMapFields(payload, onProgress),
  [MESSAGE_TYPES.ADAPT_TEXT]: (payload, onProgress) => handleAdaptText(payload, onProgress),
  [MESSAGE_TYPES.PARSE_RESUME]: (payload, onProgress) => handleParseResume(payload, onProgress),
  [MESSAGE_TYPES.GET_PROFILE]: () => getProfile(),
  [MESSAGE_TYPES.SAVE_PROFILE]: (payload) => saveProfile(payload),
  [MESSAGE_TYPES.GET_API_KEY]: () => getApiKey(),
  [MESSAGE_TYPES.SAVE_API_KEY]: (payload) => saveApiKey(payload),
  [MESSAGE_TYPES.VERIFY_API_KEY]: (apiKey) => verifyApiKey({ apiKey }),
}

const PORT_NAME = 'last-form'

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return

  let disconnected = false
  port.onDisconnect.addListener(() => {
    disconnected = true
  })

  const safePost = (message) => {
    if (disconnected) return
    try {
      port.postMessage(message)
    } catch {
      disconnected = true
    }
  }

  port.onMessage.addListener((message) => {
    const handler = handlers[message?.type]
    if (!handler) {
      safePost({ error: `Tipo de mensagem desconhecido: ${message?.type}` })
      return
    }

    safePost({ ack: true })
    const onProgress = (progress) => safePost({ progress })
    handler(message.payload, onProgress)
      .then((result) => safePost({ result }))
      .catch((error) => safePost({ error: error.message }))
  })
})
