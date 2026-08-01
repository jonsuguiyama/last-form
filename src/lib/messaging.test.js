import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendMessage, MESSAGE_TYPES } from './messaging'
import { mockChromePort, mockChromePortThatNeverResponds } from '../test/mockChromePort'

afterEach(() => {
  vi.useRealTimers()
})

describe('sendMessage', () => {
  it('resolves with the handler result once the background acks and responds', async () => {
    mockChromePort({ [MESSAGE_TYPES.GET_PROFILE]: () => 'ok' })
    await expect(sendMessage(MESSAGE_TYPES.GET_PROFILE)).resolves.toBe('ok')
  })

  it('rejects with the error message when the handler throws', async () => {
    mockChromePort({
      [MESSAGE_TYPES.GET_PROFILE]: () => {
        throw new Error('algo quebrou')
      },
    })
    await expect(sendMessage(MESSAGE_TYPES.GET_PROFILE)).rejects.toThrow('algo quebrou')
  })

  it('rejects fast with a clear error when the background never acks (hung/asleep service worker)', async () => {
    vi.useFakeTimers()
    mockChromePortThatNeverResponds()

    const promise = sendMessage(MESSAGE_TYPES.GET_PROFILE, undefined, { ackTimeoutMs: 1000 })
    const assertion = expect(promise).rejects.toThrow(/não respondeu/)

    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('rejects if the background acks but never sends a final result', async () => {
    vi.useFakeTimers()
    globalThis.chrome = {
      runtime: {
        connect: vi.fn(() => {
          const listeners = []
          return {
            onMessage: { addListener: (fn) => listeners.push(fn) },
            onDisconnect: { addListener: () => {} },
            postMessage: () => {
              queueMicrotask(() => listeners.forEach((fn) => fn({ ack: true })))
            },
            disconnect: vi.fn(),
          }
        }),
      },
    }

    const promise = sendMessage(MESSAGE_TYPES.GET_PROFILE, undefined, { resultTimeoutMs: 1000 })
    const assertion = expect(promise).rejects.toThrow(/Sem resposta em/)

    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })
})
