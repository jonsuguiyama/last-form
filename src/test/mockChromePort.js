import { vi } from 'vitest'

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
