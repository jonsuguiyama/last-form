/**
 * Lê um File (PDF) e retorna só a parte base64, sem o prefixo `data:...;base64,`
 * que o FileReader inclui - a API do Gemini espera o base64 puro.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export { fileToBase64 }
