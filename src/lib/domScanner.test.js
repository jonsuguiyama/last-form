import { describe, it, expect, beforeEach } from 'vitest'
import { scanFields, getFieldElement, getFieldElements } from './domScanner'

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

  it('collapses a radio group sharing the same name into a single field with options', () => {
    setBody(`
      <fieldset>
        <legend>Qual a sua forma de contratação?</legend>
        <label><input type="radio" name="contract" value="clt" /> CLT</label>
        <label><input type="radio" name="contract" value="pj" /> PJ</label>
      </fieldset>
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].tag).toBe('radio-group')
    expect(fields[0].label).toBe('Qual a sua forma de contratação?')
    expect(fields[0].options).toEqual(['CLT', 'PJ'])
  })

  it('gives every radio in a group the same fieldId, resolvable via getFieldElements', () => {
    setBody(`
      <label><input type="radio" name="wfh" value="yes" /> Sim</label>
      <label><input type="radio" name="wfh" value="no" /> Não</label>
    `)
    const [field] = scanFields()
    const elements = getFieldElements(field.fieldId)
    expect(elements).toHaveLength(2)
    expect(getFieldElement(field.fieldId)).toBe(elements[0])
  })

  it('does not group radios with different names, and treats an unnamed radio as its own field', () => {
    setBody(`
      <input type="radio" name="a" value="1" />
      <input type="radio" name="b" value="1" />
      <input type="radio" value="1" />
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(3)
    expect(new Set(fields.map((f) => f.fieldId)).size).toBe(3)
  })

  it('groups sibling <button> elements inside a form into a single choice field', () => {
    setBody(`
      <form>
        <p>Trabalho remoto disponível?</p>
        <div>
          <button type="button">Sim</button>
          <button type="button">Não</button>
        </div>
      </form>
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].tag).toBe('button-group')
    expect(fields[0].label).toBe('Trabalho remoto disponível?')
    expect(fields[0].options).toEqual(['Sim', 'Não'])
  })

  it('does not treat button groups outside a <form> as a choice field', () => {
    setBody(`
      <div>
        <button type="button">Sim</button>
        <button type="button">Não</button>
      </div>
    `)
    expect(scanFields()).toHaveLength(0)
  })

  it('excludes buttons that already look like navigation/submit/add buttons from choice-group detection', () => {
    setBody(`
      <form>
        <div>
          <button type="button">Voltar</button>
          <button type="button">Próximo</button>
        </div>
      </form>
    `)
    expect(scanFields()).toHaveLength(0)
  })

  it('ignores a button pair with more than the max expected choice-group size', () => {
    setBody(`
      <form>
        <div>
          <button type="button">A</button>
          <button type="button">B</button>
          <button type="button">C</button>
          <button type="button">D</button>
          <button type="button">E</button>
          <button type="button">F</button>
          <button type="button">G</button>
        </div>
      </form>
    `)
    expect(scanFields()).toHaveLength(0)
  })
})
