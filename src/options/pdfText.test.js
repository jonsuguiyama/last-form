import { describe, it, expect, vi } from 'vitest'

const textItem = (str, y) => ({ str, transform: [1, 0, 0, 1, 0, y] })

function mockPdfDocument(pages) {
  return {
    numPages: pages.length,
    getPage: (pageNumber) =>
      Promise.resolve({
        getTextContent: () => Promise.resolve({ items: pages[pageNumber - 1] }),
      }),
  }
}

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker-url' }))

let getDocumentMock
vi.mock('pdfjs-dist', () => {
  getDocumentMock = vi.fn()
  return { getDocument: getDocumentMock, GlobalWorkerOptions: {} }
})

const { extractPdfText } = await import('./pdfText')

function fakeFile() {
  return { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }
}

describe('extractPdfText', () => {
  it('joins items on the same line (same y) without a break, and starts a new line when y changes', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(mockPdfDocument([[textItem('Jon ', 700), textItem('Suguiyama', 700), textItem('Full-Stack Developer', 650)]])),
    })

    const text = await extractPdfText(fakeFile())

    expect(text).toBe('Jon Suguiyama\nFull-Stack Developer')
  })

  it('joins multiple pages with a blank line between them', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(
        mockPdfDocument([[textItem('Página 1', 700)], [textItem('Página 2', 700)]]),
      ),
    })

    const text = await extractPdfText(fakeFile())

    expect(text).toBe('Página 1\n\nPágina 2')
  })

  it('returns an empty string for a page with no text items', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(mockPdfDocument([[]])) })

    const text = await extractPdfText(fakeFile())

    expect(text).toBe('')
  })
})
