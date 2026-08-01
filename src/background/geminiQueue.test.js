import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enqueueGeminiCall, resetGeminiQueue, MIN_INTERVAL_MS } from './geminiQueue'

beforeEach(() => {
  vi.useFakeTimers()
  resetGeminiQueue()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('enqueueGeminiCall', () => {
  it('runs a single task right away, reporting position 1 of 1', async () => {
    const onQueue = vi.fn()
    const promise = enqueueGeminiCall(() => Promise.resolve('ok'), onQueue)

    await vi.advanceTimersByTimeAsync(0)
    await expect(promise).resolves.toBe('ok')
    expect(onQueue).toHaveBeenCalledWith(1, 1)
  })

  it('spaces out the start of each call by at least MIN_INTERVAL_MS', async () => {
    const startTimes = []
    const makeTask = () => () => {
      startTimes.push(Date.now())
      return Promise.resolve()
    }

    enqueueGeminiCall(makeTask())
    enqueueGeminiCall(makeTask())
    enqueueGeminiCall(makeTask())

    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS * 3)

    expect(startTimes).toHaveLength(3)
    expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(MIN_INTERVAL_MS)
    expect(startTimes[2] - startTimes[1]).toBeGreaterThanOrEqual(MIN_INTERVAL_MS)
  })

  it('reports queue position/total to every pending item as the queue drains', async () => {
    const positions = []
    const task = () => Promise.resolve()

    enqueueGeminiCall(task, (position, total) => positions.push([1, position, total]))
    enqueueGeminiCall(task, (position, total) => positions.push([2, position, total]))
    enqueueGeminiCall(task, (position, total) => positions.push([3, position, total]))

    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS * 3)

    const thirdItemPositions = positions.filter(([id]) => id === 3).map(([, position]) => position)
    expect(thirdItemPositions[0]).toBe(3)
    expect(thirdItemPositions.at(-1)).toBe(1)
  })

  it('propagates a rejected task to its own caller without blocking the rest of the queue', async () => {
    const onQueue = vi.fn()
    const failing = enqueueGeminiCall(() => Promise.reject(new Error('cota estourada')), onQueue)
    const succeeding = enqueueGeminiCall(() => Promise.resolve('ok'), onQueue)
    const failingAssertion = expect(failing).rejects.toThrow('cota estourada')
    const succeedingAssertion = expect(succeeding).resolves.toBe('ok')

    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS * 2)

    await failingAssertion
    await succeedingAssertion
  })
})
