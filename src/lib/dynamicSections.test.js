import { describe, it, expect } from 'vitest'
import { findAddButtonsBySection } from './dynamicSections'

describe('findAddButtonsBySection', () => {
  it('associates an add button with the experiences section via its heading', () => {
    document.body.innerHTML = `
      <section>
        <h2>Experiência Profissional</h2>
        <button>+ Adicionar</button>
      </section>
    `
    const buttons = findAddButtonsBySection()
    expect(buttons.experiences).toBeTruthy()
    expect(buttons.education).toBeUndefined()
  })

  it('associates separate buttons with experiences and education', () => {
    document.body.innerHTML = `
      <section><h2>Experiência</h2><button id="exp">Add</button></section>
      <section><h2>Formação Acadêmica</h2><button id="edu">Add</button></section>
    `
    const buttons = findAddButtonsBySection()
    expect(buttons.experiences.id).toBe('exp')
    expect(buttons.education.id).toBe('edu')
  })

  it('returns an empty object when no add buttons exist', () => {
    document.body.innerHTML = '<section><h2>Experiência</h2></section>'
    expect(findAddButtonsBySection()).toEqual({})
  })
})
