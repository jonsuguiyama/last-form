import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Extracts a PDF's text locally (pdf.js, the same engine behind Chrome's own
 * PDF viewer) instead of sending the raw binary to Gemini. Separating
 * "read the PDF" from "structure the data" is more reliable: text extraction
 * is a problem a dedicated lib already solves, while asking the model to do
 * both at once (understand the visual layout AND structure the JSON) is
 * what caused mixed-up/wrong fields on resumes with a more complex layout
 * (columns, icons next to contact info, etc.).
 */
async function extractPdfText(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    // Approximates line breaks: items at the same height (same "y") stay on
    // the same line, a different "y" starts a new line. Not perfect for
    // column layouts, but much better than just concatenating everything.
    let lastY = null
    let pageText = ''
    for (const item of content.items) {
      const y = item.transform?.[5]
      if (lastY !== null && y !== lastY) pageText += '\n'
      pageText += item.str
      lastY = y
    }
    pages.push(pageText)
  }

  return pages.join('\n\n')
}

export { extractPdfText }
