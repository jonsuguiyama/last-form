import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
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
