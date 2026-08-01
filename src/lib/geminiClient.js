// Alias "rolante" em vez de uma versão travada: aponta sempre pro flash atual
// (hoje resolve pro gemini-3.6-flash) e sobrevive o Google aposentando modelos
// antigos sem quebrar o código - foi exatamente isso que aconteceu com o
// gemini-2.5-flash, descontinuado pra novos usuários.
const DEFAULT_MODEL = 'gemini-flash-latest'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const NEVER_INVENT_RULE =
  'Regra inviolável: nunca invente, deduza ou "chute" um dado que não está explicitamente presente ' +
  'nos dados fornecidos. Se a informação não existir, retorne null para esse campo em vez de um valor ' +
  'plausível. Preencher errado uma candidatura de emprego real é pior do que deixar em branco.'

class GeminiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
    this.cause = cause
  }
}

/**
 * Lê uma resposta em streaming (Server-Sent Events) do Gemini, concatenando o
 * texto de cada pedaço conforme chega. `onChunk(totalCaracteresRecebidos)` -
 * se passado - é chamado a cada pedaço, pra dar progresso real (não fabricado)
 * durante uma geração longa, em vez de silêncio até a resposta inteira chegar.
 */
async function readSseText(response, onChunk) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const jsonText = line.slice(5).trim()
      if (!jsonText) continue

      const chunk = JSON.parse(jsonText)
      const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text
      if (chunkText) {
        fullText += chunkText
        onChunk?.({ type: 'stream', charsReceived: fullText.length })
      }
    }
  }

  return fullText
}

async function callGemini({ apiKey, model = DEFAULT_MODEL, contents, responseSchema, systemInstruction, onChunk }) {
  if (!apiKey) {
    throw new GeminiError('Nenhuma API key do Gemini configurada. Adicione uma na tela de Opções.')
  }

  const response = await fetch(`${API_BASE}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction
        ? { parts: [{ text: `${NEVER_INVENT_RULE}\n\n${systemInstruction}` }] }
        : { parts: [{ text: NEVER_INVENT_RULE }] },
      generationConfig: {
        responseMimeType: 'application/json',
        ...(responseSchema ? { responseSchema } : {}),
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new GeminiError(`Gemini respondeu ${response.status}`, { status: response.status, cause: body })
  }

  const text = await readSseText(response, onChunk)
  if (!text) {
    throw new GeminiError('Resposta do Gemini veio sem conteúdo utilizável.')
  }

  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new GeminiError('Resposta do Gemini não veio em JSON válido.', { cause })
  }
}

const FIELD_MAPPING_SCHEMA = {
  type: 'object',
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldId: { type: 'string' },
          value: { type: 'string', nullable: true },
          confidence: { type: 'number' },
          missingQuestion: { type: 'string', nullable: true },
        },
        required: ['fieldId', 'confidence'],
      },
    },
  },
  required: ['mappings'],
}

/**
 * Pede ao Gemini pra mapear descritores de campo (do domScanner) pra valores do
 * perfil. Campos já resolvidos por fieldBindings/customQA não devem ser mandados
 * aqui - resolver localmente é mais barato e mais previsível (ver fieldBindings.js).
 */
async function mapFields({ apiKey, profile, fields, jobDescription, extraContext, onProgress }) {
  const result = await callGemini({
    apiKey,
    onChunk: onProgress,
    responseSchema: FIELD_MAPPING_SCHEMA,
    systemInstruction:
      'Você recebe o perfil profissional de um candidato e uma lista de campos de um formulário de ' +
      'candidatura a vaga. Para cada campo, retorne o valor mais adequado do perfil, ou null com uma ' +
      'missingQuestion (a pergunta em si, reescrita de forma clara) se o perfil não tiver esse dado. ' +
      'confidence vai de 0 a 1. Se houver descrição da vaga, priorize o que for mais relevante pra ela ' +
      'ao escolher entre informações equivalentes do perfil. Se houver extraContext, siga-o estritamente ' +
      '(ex: restringir a resposta a uma entrada específica do perfil).',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify({
              profile,
              fields,
              jobDescription: jobDescription ?? null,
              extraContext: extraContext ?? null,
            }),
          },
        ],
      },
    ],
  })
  return result.mappings
}

const ADAPT_TEXT_SCHEMA = {
  type: 'object',
  properties: {
    adaptedText: { type: 'string' },
  },
  required: ['adaptedText'],
}

/**
 * Reescreve `sourceText` pra caber em `maxLength` caracteres, priorizando o que for
 * mais relevante pra `jobDescription`. Nunca adiciona fatos que não estavam no texto
 * original - só resume/reorganiza.
 */
async function adaptText({ apiKey, sourceText, maxLength, jobDescription, onProgress }) {
  const result = await callGemini({
    apiKey,
    onChunk: onProgress,
    responseSchema: ADAPT_TEXT_SCHEMA,
    systemInstruction:
      `Reescreva o texto do usuário para ter no máximo ${maxLength} caracteres, mantendo só o essencial ` +
      'e priorizando o que for mais relevante para a vaga descrita, se houver. Não adicione nenhuma ' +
      'informação, conquista ou responsabilidade que não esteja no texto original.',
    contents: [
      {
        role: 'user',
        parts: [{ text: JSON.stringify({ sourceText, maxLength, jobDescription: jobDescription ?? null }) }],
      },
    ],
  })

  return result.adaptedText.length > maxLength ? result.adaptedText.slice(0, maxLength) : result.adaptedText
}

const RESUME_SCHEMA = {
  type: 'object',
  properties: {
    personal: {
      type: 'object',
      properties: {
        fullName: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        address: { type: 'string', nullable: true },
        city: { type: 'string', nullable: true },
        country: { type: 'string', nullable: true },
        links: {
          type: 'object',
          properties: {
            linkedin: { type: 'string', nullable: true },
            github: { type: 'string', nullable: true },
            portfolio: { type: 'string', nullable: true },
          },
        },
      },
    },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          startDate: { type: 'string', nullable: true },
          endDate: { type: 'string', nullable: true },
          current: { type: 'boolean' },
          description: { type: 'string', nullable: true },
        },
        required: ['company', 'title'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          institution: { type: 'string' },
          degree: { type: 'string', nullable: true },
          field: { type: 'string', nullable: true },
          startDate: { type: 'string', nullable: true },
          endDate: { type: 'string', nullable: true },
        },
        required: ['institution'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { language: { type: 'string' }, level: { type: 'string', nullable: true } },
        required: ['language'],
      },
    },
  },
}

/**
 * Extrai um perfil estruturado a partir do PDF do currículo (base64, sem o prefixo
 * data:). Seções que não existem no currículo voltam como array vazio - nunca
 * inventadas.
 */
async function parseResume({ apiKey, pdfBase64, onProgress }) {
  return callGemini({
    apiKey,
    onChunk: onProgress,
    responseSchema: RESUME_SCHEMA,
    systemInstruction:
      'Extraia os dados estruturados deste currículo em PDF. Se uma seção inteira não existir no ' +
      'documento (ex: sem idiomas listados), retorne um array vazio para ela - não invente uma entrada.',
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }],
      },
    ],
  })
}

/**
 * Testa a API key contra a API de verdade (GET no recurso do modelo, chamada
 * leve e sem custo de geração) em vez de só validar formato. Lança GeminiError
 * se a chave não funcionar.
 */
async function verifyApiKey({ apiKey }) {
  if (!apiKey) {
    throw new GeminiError('Nenhuma API key informada.')
  }

  const response = await fetch(`${API_BASE}/${DEFAULT_MODEL}?key=${encodeURIComponent(apiKey)}`)
  if (!response.ok) {
    throw new GeminiError(`A API key não funcionou (Gemini respondeu ${response.status}).`, {
      status: response.status,
    })
  }
  return true
}

export { mapFields, adaptText, parseResume, verifyApiKey, GeminiError }
