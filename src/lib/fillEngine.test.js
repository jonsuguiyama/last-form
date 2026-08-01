import { describe, it, expect, vi } from 'vitest'
import { setNativeValue, fillField, addRepeatableEntries } from './fillEngine'

describe('setNativeValue', () => {
  it('sets the value and dispatches input + change events', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    const onInput = vi.fn()
    const onChange = vi.fn()
    input.addEventListener('input', onInput)
    input.addEventListener('change', onChange)

    setNativeValue(input, 'Jon Suguiyama')

    expect(input.value).toBe('Jon Suguiyama')
    expect(onInput).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledOnce()

    document.body.removeChild(input)
  })

  it('goes through the prototype setter even when the instance has its own value tracker (React pattern)', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    let trackedValue = ''
    Object.defineProperty(input, '_reactTrackedValue', {
      get: () => trackedValue,
      set: (v) => {
        trackedValue = v
      },
    })
    input.addEventListener('input', () => {
      input._reactTrackedValue = input.value
    })

    setNativeValue(input, 'valor via setter nativo')

    expect(input._reactTrackedValue).toBe('valor via setter nativo')
    document.body.removeChild(input)
  })
})

describe('fillField', () => {
  it('returns false for a null/undefined value without touching the element', () => {
    const input = document.createElement('input')
    expect(fillField(input, null)).toBe(false)
    expect(input.value).toBe('')
  })

  it('fills a select by matching visible option text', () => {
    const select = document.createElement('select')
    select.innerHTML = '<option value="br">Brasil</option><option value="us">Estados Unidos</option>'
    expect(fillField(select, 'Estados Unidos')).toBe(true)
    expect(select.value).toBe('us')
  })

  it('returns false when no select option matches', () => {
    const select = document.createElement('select')
    select.innerHTML = '<option value="br">Brasil</option>'
    expect(fillField(select, 'Argentina')).toBe(false)
  })

  it('checks a checkbox when value is truthy', () => {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    document.body.appendChild(checkbox)
    expect(fillField(checkbox, true)).toBe(true)
    expect(checkbox.checked).toBe(true)
    document.body.removeChild(checkbox)
  })
})

describe('addRepeatableEntries', () => {
  it('clicks the button once per missing entry', async () => {
    const button = document.createElement('button')
    const onClick = vi.fn()
    button.addEventListener('click', onClick)
    document.body.appendChild(button)

    await addRepeatableEntries(button, 3, { scopeEl: document.body })

    expect(onClick).toHaveBeenCalledTimes(3)
    document.body.removeChild(button)
  })

  it('does nothing when count is 0', async () => {
    const button = document.createElement('button')
    const onClick = vi.fn()
    button.addEventListener('click', onClick)

    await addRepeatableEntries(button, 0)

    expect(onClick).not.toHaveBeenCalled()
  })
})
