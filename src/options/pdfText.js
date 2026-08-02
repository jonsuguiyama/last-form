import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const SAME_LINE_TOLERANCE = 2

function extractPageText(items) {
  let lastY = null
  let pageText = ''
  for (const item of items) {
    const y = item.transform?.[5]
    const sameLine = lastY !== null && Math.abs(y - lastY) <= SAME_LINE_TOLERANCE
    if (lastY !== null) pageText += sameLine ? ' ' : '\n'
    pageText += item.str
    lastY = y
  }
  return pageText
}

async function extractPageLinks(page) {
  const annotations = await page.getAnnotations()
  return annotations.map((a) => a.url || a.unsafeUrl).filter(Boolean)
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const pages = []
  const links = new Set()

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(extractPageText(content.items))
    ;(await extractPageLinks(page)).forEach((url) => links.add(url))
  }

  const text = pages.join('\n\n')
  return links.size > 0 ? `${text}\n\nLinks encontrados no documento:\n${[...links].join('\n')}` : text
}

export { extractPdfText }
