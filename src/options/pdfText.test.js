import { describe, it, expect, vi } from 'vitest'

const textItem = (str, y) => ({ str, transform: [1, 0, 0, 1, 0, y] })

function mockPdfDocument(pages, annotationsByPage = []) {
  return {
    numPages: pages.length,
    getPage: (pageNumber) =>
      Promise.resolve({
        getTextContent: () => Promise.resolve({ items: pages[pageNumber - 1] }),
        getAnnotations: () => Promise.resolve(annotationsByPage[pageNumber - 1] ?? []),
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
  it('joins items on the same line with a space, and starts a new line when y changes', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(mockPdfDocument([[textItem('Jon', 700), textItem('Suguiyama', 700), textItem('Full-Stack Developer', 650)]])),
    })

    const text = await extractPdfText(fakeFile())

    expect(text).toBe('Jon Suguiyama\nFull-Stack Developer')
  })

  it('treats items with a tiny y difference as the same line (sub-pixel rounding in real PDFs)', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(
        mockPdfDocument([[textItem('jon.suguiyama', 700), textItem('@gmail.com', 700.4)]]),
      ),
    })

    const text = await extractPdfText(fakeFile())

    expect(text).toBe('jon.suguiyama @gmail.com')
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

  it('returns an empty string for a page with no text items and no links', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(mockPdfDocument([[]])) })

    const text = await extractPdfText(fakeFile())

    expect(text).toBe('')
  })

  it('appends link annotation URLs found in the PDF, deduplicated', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(
        mockPdfDocument(
          [[textItem('Jon Suguiyama', 700)]],
          [
            [
              { url: 'https://github.com/jonsuguiyama' },
              { url: 'https://linkedin.com/in/jonsuguiyama' },
              { url: 'https://github.com/jonsuguiyama' },
              {},
            ],
          ],
        ),
      ),
    })

    const text = await extractPdfText(fakeFile())

    expect(text).toBe(
      'Jon Suguiyama\n\nLinks encontrados no documento:\nhttps://github.com/jonsuguiyama\nhttps://linkedin.com/in/jonsuguiyama',
    )
  })
})
