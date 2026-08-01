import { describe, it, expect, beforeEach } from 'vitest'
import { scanFields } from './domScanner'

function setBody(html) {
  document.body.innerHTML = html
}

describe('scanFields', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('finds label via <label for>', () => {
    setBody(`
      <form>
        <label for="full-name">Nome completo</label>
        <input id="full-name" name="fullName" />
      </form>
    `)
    const [field] = scanFields()
    expect(field.label).toBe('Nome completo')
    expect(field.name).toBe('fullName')
  })

  it('finds label from wrapping <label>', () => {
    setBody(`
      <form>
        <label>Telefone <input name="phone" /></label>
      </form>
    `)
    const [field] = scanFields()
    expect(field.label).toContain('Telefone')
  })

  it('falls back to placeholder when no label exists', () => {
    setBody(`<input name="email" placeholder="seu@email.com" />`)
    const [field] = scanFields()
    expect(field.label).toBe('seu@email.com')
  })

  it('reads maxlength attribute as char limit', () => {
    setBody(`<textarea name="bio" maxlength="400"></textarea>`)
    const [field] = scanFields()
    expect(field.charLimit).toEqual({ max: 400, source: 'attribute' })
  })

  it('falls back to a visual counter like "120/400" when no maxlength attribute exists', () => {
    setBody(`
      <div>
        <textarea name="bio"></textarea>
        <span>120/400</span>
      </div>
    `)
    const [field] = scanFields()
    expect(field.charLimit).toEqual({ max: 400, source: 'counter-text' })
  })

  it('detects required via attribute', () => {
    setBody(`<input name="email" required />`)
    const [field] = scanFields()
    expect(field.required).toBe(true)
  })

  it('detects required via asterisk in nearby text', () => {
    setBody(`<div><label>Email *</label><input name="email" /></div>`)
    const [field] = scanFields()
    expect(field.required).toBe(true)
  })

  it('skips hidden and disabled fields', () => {
    setBody(`
      <input type="hidden" name="csrf" value="x" />
      <input name="disabled-field" disabled />
      <input name="visible-field" />
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('visible-field')
  })

  it('assigns a stable fieldId that can be used to look the element back up', () => {
    setBody(`<input name="a" /><input name="b" />`)
    const fields = scanFields()
    expect(fields[0].fieldId).not.toBe(fields[1].fieldId)
  })

  it('groups fields under their fieldset legend as section', () => {
    setBody(`
      <fieldset>
        <legend>Experiência 1</legend>
        <input name="company" />
      </fieldset>
    `)
    const [field] = scanFields()
    expect(field.section).toBe('Experiência 1')
  })
})
