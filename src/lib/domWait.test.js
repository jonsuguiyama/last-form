import { describe, it, expect, vi } from 'vitest'
import { waitForStableDom, clickAndWait } from './domWait'

describe('waitForStableDom', () => {
  it('resolves after the quiet period when nothing changes', async () => {
    const container = document.createElement('div')
    const start = Date.now()
    await waitForStableDom(container, { quietPeriodMs: 20, timeoutMs: 1000 })
    expect(Date.now() - start).toBeGreaterThanOrEqual(15)
  })

  it('waits for mutations to stop before resolving', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    let resolved = false
    const promise = waitForStableDom(container, { quietPeriodMs: 30, timeoutMs: 1000 }).then(() => {
      resolved = true
    })

    setTimeout(() => container.appendChild(document.createElement('span')), 10)
    setTimeout(() => container.appendChild(document.createElement('span')), 25)

    await new Promise((r) => setTimeout(r, 35))
    expect(resolved).toBe(false)

    await promise
    expect(resolved).toBe(true)

    document.body.removeChild(container)
  })

  it('never hangs past timeoutMs even with constant mutations', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const interval = setInterval(() => container.appendChild(document.createElement('span')), 5)

    const start = Date.now()
    await waitForStableDom(container, { quietPeriodMs: 1000, timeoutMs: 60 })
    expect(Date.now() - start).toBeLessThan(200)

    clearInterval(interval)
    document.body.removeChild(container)
  })
})

describe('clickAndWait', () => {
  it('clicks the element then waits for stability', async () => {
    const button = document.createElement('button')
    const onClick = vi.fn()
    button.addEventListener('click', onClick)
    document.body.appendChild(button)

    await clickAndWait(button, { scopeEl: document.body, quietPeriodMs: 10, timeoutMs: 200 })

    expect(onClick).toHaveBeenCalledOnce()
    document.body.removeChild(button)
  })
})
