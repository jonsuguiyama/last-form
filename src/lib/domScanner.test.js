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

  it('prefers a nearby question heading over a generic instructional placeholder', () => {
    setBody(`
      <div>
        <p>Qual seu salário atual ou último salário?</p>
        <textarea name="salary" placeholder="Digite sua resposta aqui" maxlength="1000"></textarea>
        <span>Máx. 1000 caracteres</span>
      </div>
    `)
    const [field] = scanFields()
    expect(field.label).toBe('Qual seu salário atual ou último salário?')
  })

  it('scopes the scan to an open dialog, ignoring fields on the page behind it', () => {
    setBody(`
      <div id="page-behind">
        <input name="search" placeholder="Buscar vagas" />
        <input type="checkbox" name="remote" /> Remote
      </div>
      <div role="dialog" aria-modal="true">
        <label for="salary">Pretensão salarial</label>
        <input id="salary" name="salary" />
      </div>
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('salary')
  })

  it('returns no fields for the top frame when it looks like the background behind a modal opened in another frame (locked body scroll + an iframe present, no dialog of its own)', () => {
    setBody(`
      <input name="search" placeholder="Buscar vagas" />
      <iframe src="about:blank"></iframe>
    `)
    document.body.style.overflow = 'hidden'
    try {
      expect(scanFields()).toEqual([])
    } finally {
      document.body.style.overflow = ''
    }
  })

  it('still scans normally when there is an iframe but the body scroll is not locked', () => {
    setBody(`
      <input name="search" placeholder="Buscar vagas" />
      <iframe src="about:blank"></iframe>
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
  })

  it('groups a multi-select checkbox question into one checkbox-group field (bare checkboxes)', () => {
    setBody(`
      <div>
        <p>Quais linguagens de programação você possui conhecimento?</p>
        <div>
          <input type="checkbox" id="lang-node" /><label for="lang-node">Node</label>
          <input type="checkbox" id="lang-react" /><label for="lang-react">React</label>
          <input type="checkbox" id="lang-php" /><label for="lang-php">PHP</label>
        </div>
      </div>
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].tag).toBe('checkbox-group')
    expect(fields[0].label).toBe('Quais linguagens de programação você possui conhecimento?')
    expect(fields[0].options).toEqual(['Node', 'React', 'PHP'])
  })

  it('groups a multi-select checkbox question when each option wraps its own checkbox in a <label>', () => {
    setBody(`
      <div>
        <p>Quais linguagens de programação você possui conhecimento?</p>
        <div>
          <label><input type="checkbox" /> Node</label>
          <label><input type="checkbox" /> React</label>
          <label><input type="checkbox" /> Ruby on Rails</label>
          <label><input type="checkbox" /> PHP</label>
          <label><input type="checkbox" /> Python</label>
          <label><input type="checkbox" /> Outras</label>
        </div>
      </div>
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].tag).toBe('checkbox-group')
    expect(fields[0].options).toEqual(['Node', 'React', 'Ruby on Rails', 'PHP', 'Python', 'Outras'])
  })

  it('does not group a single standalone checkbox (e.g. accept terms)', () => {
    setBody(`<label><input type="checkbox" /> Eu concordo com os termos</label>`)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].tag).not.toBe('checkbox-group')
    expect(fields[0].type).toBe('checkbox')
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

  it('skips password fields so their live value never leaves the page', () => {
    setBody(`
      <input type="password" name="site-password" value="hunter2" />
      <input name="visible-field" />
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('visible-field')
  })

  it('still detects a radio group whose native inputs are display:none but wrapped in a visible custom-styled label', () => {
    setBody(`
      <fieldset>
        <legend>Foi indicado?</legend>
        <label><input type="radio" name="referred" value="no" style="display:none" /> Não</label>
        <label><input type="radio" name="referred" value="yes" style="display:none" /> Sim</label>
      </fieldset>
    `)
    const fields = scanFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].tag).toBe('radio-group')
    expect(fields[0].options).toEqual(['Não', 'Sim'])
  })

  it('still filters out a field with display:none and no visible label at all', () => {
    setBody(`<input type="text" name="honeypot" style="display:none" />`)
    expect(scanFields()).toHaveLength(0)
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
