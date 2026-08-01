// Gemini 2.5 Flash free tier: 10 requisições/minuto. Espaçar início de cada
// chamada em ~6.5s mantém uma margem de segurança sob esse limite mesmo com
// várias abas (várias vagas abertas ao mesmo tempo) usando a extensão - todas
// compartilham este mesmo service worker, então é aqui, num só lugar, que dá
// pra pacear as chamadas de saída. Sem broker externo: é só um array em
// memória, porque só existe um processo (o próprio service worker).
const MIN_INTERVAL_MS = 6500

let queue = []
let dispatchTimer = null
let lastDispatchAt = 0

function notifyPositions() {
  queue.forEach((item, index) => item.onQueue?.(index + 1, queue.length))
}

function scheduleDispatch() {
  if (dispatchTimer || queue.length === 0) return

  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastDispatchAt))
  dispatchTimer = setTimeout(() => {
    dispatchTimer = null
    const item = queue.shift()
    notifyPositions()
    lastDispatchAt = Date.now()
    item.task().then(item.resolve, item.reject)
    scheduleDispatch()
  }, wait)
}

/**
 * Enfileira uma chamada ao Gemini. `onQueue(position, total)` é chamado toda
 * vez que a posição na fila muda - o chamador decide se/como mostrar isso
 * (normalmente só quando total > 1, pra não falar de "fila" quando é a única
 * chamada pendente).
 */
function enqueueGeminiCall(task, onQueue) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject, onQueue })
    notifyPositions()
    scheduleDispatch()
  })
}

/** Só pra testes: zera o estado do módulo entre execuções. */
function resetGeminiQueue() {
  clearTimeout(dispatchTimer)
  dispatchTimer = null
  queue = []
  lastDispatchAt = 0
}

export { enqueueGeminiCall, resetGeminiQueue, MIN_INTERVAL_MS }
