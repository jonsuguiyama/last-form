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
        id: 'test-extension-id',
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

  it('rejects with a clear message when the extension context was invalidated (reload/update)', async () => {
    globalThis.chrome = { runtime: { id: undefined, connect: vi.fn() } }
    await expect(sendMessage(MESSAGE_TYPES.GET_PROFILE)).rejects.toThrow(/recarregada ou atualizada/)
    expect(globalThis.chrome.runtime.connect).not.toHaveBeenCalled()
  })

  it('rejects with a clear message when connect() throws because the context died mid-call', async () => {
    globalThis.chrome = {
      runtime: {
        id: 'test-extension-id',
        connect: vi.fn(() => {
          throw new Error('Extension context invalidated.')
        }),
      },
    }
    await expect(sendMessage(MESSAGE_TYPES.GET_PROFILE)).rejects.toThrow(/recarregada ou atualizada/)
  })
})
