import { describe, it, expect } from 'vitest'
import { findNextStepButton, looksLikeSubmitButton } from './wizardNav'

describe('findNextStepButton', () => {
  it('finds a button with "Próximo" text', () => {
    document.body.innerHTML = '<button>Voltar</button><button>Próximo</button>'
    const btn = findNextStepButton()
    expect(btn.textContent).toBe('Próximo')
  })

  it('finds "Continuar" in english/portuguese variants', () => {
    document.body.innerHTML = '<button>Continue</button>'
    expect(findNextStepButton().textContent).toBe('Continue')
  })

  it('does not treat the final submit button as a next-step button', () => {
    document.body.innerHTML = '<button>Enviar candidatura</button>'
    expect(findNextStepButton()).toBeNull()
  })

  it('ignores disabled buttons', () => {
    document.body.innerHTML = '<button disabled>Próximo</button>'
    expect(findNextStepButton()).toBeNull()
  })

  it('returns null when there is nothing that looks like navigation', () => {
    document.body.innerHTML = '<button>Salvar rascunho</button>'
    expect(findNextStepButton()).toBeNull()
  })
})

describe('looksLikeSubmitButton', () => {
  it('recognizes common submit phrasing', () => {
    const btn = document.createElement('button')
    btn.textContent = 'Enviar candidatura'
    expect(looksLikeSubmitButton(btn)).toBe(true)
  })

  it('does not flag a next-step button as submit', () => {
    const btn = document.createElement('button')
    btn.textContent = 'Próximo'
    expect(looksLikeSubmitButton(btn)).toBe(false)
  })
})
