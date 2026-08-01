import { vi } from 'vitest'

/**
 * Simula o lado do background pra chrome.runtime.connect: cada handler em
 * `handlers` roda quando chega uma mensagem daquele tipo, respondendo com o
 * mesmo protocolo ack/result/error implementado em src/background/index.js.
 * Cada chamada a connect() abre uma "porta" independente, igual no Chrome de verdade.
 */
function mockChromePort(handlers) {
  globalThis.chrome = {
    runtime: {
      connect: vi.fn(() => {
        const messageListeners = []

        return {
          onMessage: { addListener: (fn) => messageListeners.push(fn) },
          onDisconnect: { addListener: () => {} },
          postMessage: (message) => {
            const handler = handlers[message.type]
            queueMicrotask(async () => {
              if (!handler) {
                messageListeners.forEach((fn) => fn({ error: `Tipo de mensagem desconhecido: ${message.type}` }))
                return
              }
              messageListeners.forEach((fn) => fn({ ack: true }))
              try {
                const result = await handler(message.payload)
                messageListeners.forEach((fn) => fn({ result }))
              } catch (error) {
                messageListeners.forEach((fn) => fn({ error: error.message }))
              }
            })
          },
          disconnect: vi.fn(),
        }
      }),
    },
  }
}

/** Porta que nunca responde nada - simula um service worker travado/dormindo. */
function mockChromePortThatNeverResponds() {
  globalThis.chrome = {
    runtime: {
      connect: vi.fn(() => ({
        onMessage: { addListener: () => {} },
        onDisconnect: { addListener: () => {} },
        postMessage: () => {},
        disconnect: vi.fn(),
      })),
    },
  }
}

export { mockChromePort, mockChromePortThatNeverResponds }
