const listeners = new Set()
const MAX_HISTORY = 100
let history = []

function logEvent(label, details = {}) {
  const entry = { time: new Date().toLocaleTimeString('pt-BR'), label, ...details }
  history = [...history, entry].slice(-MAX_HISTORY)
  listeners.forEach((listener) => listener(entry))
}

function subscribeToLog(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getLogHistory() {
  return history
}

export { logEvent, subscribeToLog, getLogHistory }
