import { describe, it, expect, vi, afterEach } from 'vitest'
import { mapFields, verifyApiKey, GeminiError } from './geminiClient'

function mockFetchResponse({ ok = true, status = 200, json, text }) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(text ?? JSON.stringify(json)),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('callGemini (via mapFields)', () => {
  const baseArgs = { apiKey: 'fake-key', profile: {}, fields: [{ fieldId: '1', label: 'Nome' }] }

  it('concatenates text across multiple parts in the same candidate', async () => {
    mockFetchResponse({
      json: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"mappings":[{"fieldId":"1","confidence":1,' }, { text: '"value":"Jon"}]}' }],
            },
          },
        ],
      },
    })

    const result = await mapFields(baseArgs)
    expect(result).toEqual([{ fieldId: '1', confidence: 1, value: 'Jon' }])
  })

  it('skips thought parts instead of including them in the parsed text', async () => {
    mockFetchResponse({
      json: {
        candidates: [
          {
            content: {
              parts: [
                { text: 'isto não deveria aparecer no JSON final', thought: true },
                { text: '{"mappings":[{"fieldId":"1","confidence":1,"value":"Jon"}]}' },
              ],
            },
          },
        ],
      },
    })

    const result = await mapFields(baseArgs)
    expect(result).toEqual([{ fieldId: '1', confidence: 1, value: 'Jon' }])
  })

  it('throws a GeminiError when the HTTP response is not ok', async () => {
    mockFetchResponse({ ok: false, status: 429, text: 'rate limited' })
    await expect(mapFields(baseArgs)).rejects.toThrow(GeminiError)
  })

  it('throws a GeminiError when the response text is not valid JSON', async () => {
    mockFetchResponse({
      json: { candidates: [{ content: { parts: [{ text: 'isto não é json' }] } }] },
    })
    await expect(mapFields(baseArgs)).rejects.toThrow(/JSON válido/)
  })

  it('throws a GeminiError when there is no usable content at all', async () => {
    mockFetchResponse({ json: { candidates: [] } })
    await expect(mapFields(baseArgs)).rejects.toThrow(/sem conteúdo utilizável/)
  })
})

describe('verifyApiKey', () => {
  it('resolves true when the key check succeeds', async () => {
    mockFetchResponse({ json: { name: 'models/gemini-flash-latest' } })
    await expect(verifyApiKey({ apiKey: 'fake-key' })).resolves.toBe(true)
  })

  it('throws when the key check fails', async () => {
    mockFetchResponse({ ok: false, status: 403 })
    await expect(verifyApiKey({ apiKey: 'fake-key' })).rejects.toThrow(GeminiError)
  })

  it('throws immediately with no fetch call when no key is given', async () => {
    global.fetch = vi.fn()
    await expect(verifyApiKey({ apiKey: '' })).rejects.toThrow(GeminiError)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
