import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OptionsApp from './OptionsApp'
import { MESSAGE_TYPES } from '../lib/messaging'
import { emptyProfile } from '../lib/profileSchema'
import { mockChromePort as mockChrome } from '../test/mockChromePort'

describe('OptionsApp - fluxo da API key', () => {
  it('começa em modo de edição, sem seção de Currículo, quando não há chave nem perfil salvos', async () => {
    mockChrome({
      [MESSAGE_TYPES.GET_PROFILE]: () => emptyProfile(),
      [MESSAGE_TYPES.GET_API_KEY]: () => '',
    })

    render(<OptionsApp />)

    expect(await screen.findByPlaceholderText('AIza…')).toBeInTheDocument()
    expect(screen.queryByText('Currículo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('nunca mostra o input preenchido para uma chave já salva e verificada (guarda de regressão)', async () => {
    mockChrome({
      [MESSAGE_TYPES.GET_PROFILE]: () => emptyProfile(),
      [MESSAGE_TYPES.GET_API_KEY]: () => 'chave-ja-salva-funcionando',
      [MESSAGE_TYPES.VERIFY_API_KEY]: () => true,
    })

    render(<OptionsApp />)

    expect(await screen.findByText('✓ Chave configurada e verificada.')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('AIza…')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trocar chave' })).toBeInTheDocument()
  })

  it('só passa pro modo travado depois que Verificar e Salvar funcionam de verdade, e libera o Currículo', async () => {
    const user = userEvent.setup()
    mockChrome({
      [MESSAGE_TYPES.GET_PROFILE]: () => emptyProfile(),
      [MESSAGE_TYPES.GET_API_KEY]: () => '',
      [MESSAGE_TYPES.VERIFY_API_KEY]: () => true,
      [MESSAGE_TYPES.SAVE_API_KEY]: () => undefined,
    })

    render(<OptionsApp />)

    const input = await screen.findByPlaceholderText('AIza…')
    await user.type(input, 'uma-chave-falsa-mas-com-tamanho-suficiente')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('✓ Chave configurada e verificada.')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('AIza…')).not.toBeInTheDocument()
    expect(await screen.findByText('Currículo')).toBeInTheDocument()
  })

  it('mostra a chave quebrada editável (não trava) quando a verificação falha', async () => {
    mockChrome({
      [MESSAGE_TYPES.GET_PROFILE]: () => emptyProfile(),
      [MESSAGE_TYPES.GET_API_KEY]: () => 'chave-que-parou-de-funcionar',
      [MESSAGE_TYPES.VERIFY_API_KEY]: () => {
        throw new Error('Gemini respondeu 403')
      },
    })

    render(<OptionsApp />)

    expect(await screen.findByDisplayValue('chave-que-parou-de-funcionar')).toBeInTheDocument()
    expect(screen.queryByText('Currículo')).not.toBeInTheDocument()
  })

  it('o botão Salvar continua desabilitado enquanto a chave digitada é curta demais', async () => {
    const user = userEvent.setup()
    mockChrome({
      [MESSAGE_TYPES.GET_PROFILE]: () => emptyProfile(),
      [MESSAGE_TYPES.GET_API_KEY]: () => '',
    })

    render(<OptionsApp />)

    const input = await screen.findByPlaceholderText('AIza…')
    await user.type(input, 'curta')

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })
})

describe('OptionsApp - upload de currículo', () => {
  it('mantém o erro visível depois que a extração termina (guarda de regressão: mensagem não pode sumir)', async () => {
    const user = userEvent.setup()
    mockChrome({
      [MESSAGE_TYPES.GET_PROFILE]: () => emptyProfile(),
      [MESSAGE_TYPES.GET_API_KEY]: () => 'chave-ja-salva-funcionando',
      [MESSAGE_TYPES.VERIFY_API_KEY]: () => true,
      [MESSAGE_TYPES.PARSE_RESUME]: () => {
        throw new Error('Gemini respondeu 503')
      },
    })

    render(<OptionsApp />)

    await screen.findByText('Currículo')
    const input = document.querySelector('input[type="file"]')
    const file = new File(['conteúdo falso'], 'curriculo.pdf', { type: 'application/pdf' })

    await user.upload(input, file)

    expect(await screen.findByText(/Erro ao extrair o currículo: Gemini respondeu 503/)).toBeInTheDocument()
    // Não é só aparecer - tem que continuar lá depois que "extracting" termina.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByText(/Erro ao extrair o currículo: Gemini respondeu 503/)).toBeInTheDocument()
  })

  it('resolve o perfil e revela as seções depois de uma extração bem-sucedida', async () => {
    const user = userEvent.setup()
    mockChrome({
      [MESSAGE_TYPES.GET_PROFILE]: () => emptyProfile(),
      [MESSAGE_TYPES.GET_API_KEY]: () => 'chave-ja-salva-funcionando',
      [MESSAGE_TYPES.VERIFY_API_KEY]: () => true,
      [MESSAGE_TYPES.PARSE_RESUME]: () => ({
        personal: { fullName: 'Jon Suguiyama' },
        experiences: [],
        education: [],
        skills: [],
        languages: [],
      }),
    })

    render(<OptionsApp />)

    await screen.findByText('Currículo')
    const input = document.querySelector('input[type="file"]')
    const file = new File(['conteúdo falso'], 'curriculo.pdf', { type: 'application/pdf' })
    await user.upload(input, file)

    expect(await screen.findByDisplayValue('Jon Suguiyama')).toBeInTheDocument()
  })
})
