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

function enqueueGeminiCall(task, onQueue) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject, onQueue })
    notifyPositions()
    scheduleDispatch()
  })
}

function resetGeminiQueue() {
  clearTimeout(dispatchTimer)
  dispatchTimer = null
  queue = []
  lastDispatchAt = 0
}

export { enqueueGeminiCall, resetGeminiQueue, MIN_INTERVAL_MS }
