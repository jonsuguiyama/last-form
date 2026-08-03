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

async function callGemini({ apiKey, model = DEFAULT_MODEL, contents, responseSchema, systemInstruction }) {
  if (!apiKey) {
    throw new GeminiError('Nenhuma API key do Gemini configurada. Adicione uma na tela de Opções.')
  }

  const response = await fetch(`${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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

  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text)
    .join('')

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

async function mapFields({ apiKey, profile, fields, jobDescription, extraContext }) {
  const result = await callGemini({
    apiKey,
    responseSchema: FIELD_MAPPING_SCHEMA,
    systemInstruction:
      'Você recebe o perfil profissional de um candidato e uma lista de campos de um formulário de ' +
      'candidatura a vaga. Para cada campo, retorne o valor mais adequado do perfil, ou null com uma ' +
      'missingQuestion (a pergunta em si, reescrita de forma clara) se o perfil não tiver esse dado. ' +
      'confidence vai de 0 a 1. Se houver descrição da vaga, priorize o que for mais relevante pra ela ' +
      'ao escolher entre informações equivalentes do perfil. Se houver extraContext, siga-o estritamente ' +
      '(ex: restringir a resposta a uma entrada específica do perfil). Se o idioma do formulário ' +
      '(pelos labels dos campos) for diferente do idioma em que o perfil está escrito, traduza texto ' +
      'livre (descrições, resumos, respostas abertas) para o idioma do formulário - isso é tradução, ' +
      'não invenção, e é esperado. NÃO traduza nomes próprios, nomes de empresas/instituições, emails, ' +
      'links/URLs ou datas - esses ficam como estão no perfil. Para campos com type "checkbox" ' +
      '(geralmente um checkbox por opção, ex: "Inglês Básico", "Inglês Avançado", "Espanhol Intermediário" ' +
      'como checkboxes separados de um mesmo grupo de nível de idioma), o value deve ser sempre a string ' +
      '"true" ou "false", nunca null: "true" se o label desse checkbox especificamente corresponde ao que ' +
      'está no perfil (ex: o perfil diz "Inglês - Avançado", então marque true só o checkbox "Inglês ' +
      'Avançado", e false os outros níveis de inglês), "false" caso contrário. Marcar false não é inventar ' +
      'dado, é a resposta correta para uma opção que não se aplica. Para campos com type "checkbox-group" ' +
      '(uma pergunta única de múltipla escolha, com uma lista de opções em vez de um checkbox isolado, ' +
      'ex: "Quais linguagens de programação você possui conhecimento?" com opções ["Node", "React", ' +
      '"PHP"...]), o value deve ser uma única string com as opções que se aplicam ao perfil, separadas ' +
      'por vírgula, usando exatamente o texto de cada opção como veio em "options" (ex: "Node, React"), ' +
      'ou uma string vazia se nenhuma opção do perfil bater com nenhuma das opções oferecidas.',
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

async function adaptText({ apiKey, sourceText, maxLength, jobDescription }) {
  const result = await callGemini({
    apiKey,
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

async function parseResume({ apiKey, resumeText }) {
  return callGemini({
    apiKey,
    responseSchema: RESUME_SCHEMA,
    systemInstruction:
      'Extraia os dados estruturados deste currículo (texto puro, extraído de um PDF - a ordem das ' +
      'linhas pode estar levemente fora do layout visual original, com cuidado). O documento pode estar ' +
      'em português ou inglês - leia com atenção pra não misturar campos diferentes (ex: não junte ' +
      'telefone e email num só campo; cada um vai no seu lugar, sem o texto do outro colado junto). ' +
      'Procure pelas seções de experiência profissional e educação mesmo que tenham outro título (ex: ' +
      '"Professional Experience", "Employment History", "Academic Background", "Formação"), e releia o ' +
      'texto inteiro antes de concluir que uma seção não existe - só retorne array vazio se, depois de ' +
      'revisar com cuidado, a informação realmente não estiver em lugar nenhum do texto.',
    contents: [
      {
        role: 'user',
        parts: [{ text: resumeText }],
      },
    ],
  })
}

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
