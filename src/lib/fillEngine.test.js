import { describe, it, expect, vi } from 'vitest'
import { setNativeValue, fillField, addRepeatableEntries, fillRadioGroup, fillButtonGroup } from './fillEngine'

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

describe('fillRadioGroup', () => {
  function radioPair() {
    document.body.innerHTML = `
      <label><input type="radio" name="contract" value="clt" /> CLT</label>
      <label><input type="radio" name="contract" value="pj" /> PJ</label>
    `
    return Array.from(document.querySelectorAll('input[type="radio"]'))
  }

  it('checks the radio whose label matches the value exactly', () => {
    const radios = radioPair()
    expect(fillRadioGroup(radios, 'PJ')).toBe(true)
    expect(radios[0].checked).toBe(false)
    expect(radios[1].checked).toBe(true)
  })

  it('matches case-insensitively and falls back to a partial match', () => {
    const radios = radioPair()
    expect(fillRadioGroup(radios, 'clt')).toBe(true)
    expect(radios[0].checked).toBe(true)
  })

  it('returns false without checking anything when no option matches', () => {
    const radios = radioPair()
    expect(fillRadioGroup(radios, 'Estágio')).toBe(false)
    expect(radios.some((r) => r.checked)).toBe(false)
  })

  it('returns false for a null value or an empty group', () => {
    const radios = radioPair()
    expect(fillRadioGroup(radios, null)).toBe(false)
    expect(fillRadioGroup([], 'CLT')).toBe(false)
  })
})

describe('fillButtonGroup', () => {
  function yesNoButtons() {
    document.body.innerHTML = `<button type="button">Sim</button><button type="button">Não</button>`
    return Array.from(document.querySelectorAll('button'))
  }

  it('clicks the button whose text matches the value', () => {
    const buttons = yesNoButtons()
    const onClick = vi.fn()
    buttons[0].addEventListener('click', onClick)

    expect(fillButtonGroup(buttons, 'Sim')).toBe(true)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('returns false without clicking anything when no button matches', () => {
    const buttons = yesNoButtons()
    const onClick = vi.fn()
    buttons.forEach((b) => b.addEventListener('click', onClick))

    expect(fillButtonGroup(buttons, 'Talvez')).toBe(false)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('returns false for a null value or an empty group', () => {
    const buttons = yesNoButtons()
    expect(fillButtonGroup(buttons, null)).toBe(false)
    expect(fillButtonGroup([], 'Sim')).toBe(false)
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
