import { logEvent } from './debugLog'

const MESSAGE_TYPES = {
  MAP_FIELDS: 'MAP_FIELDS',
  ADAPT_TEXT: 'ADAPT_TEXT',
  PARSE_RESUME: 'PARSE_RESUME',
  GET_PROFILE: 'GET_PROFILE',
  SAVE_PROFILE: 'SAVE_PROFILE',
  GET_API_KEY: 'GET_API_KEY',
  SAVE_API_KEY: 'SAVE_API_KEY',
  VERIFY_API_KEY: 'VERIFY_API_KEY',
  ACTIVATE_ON_TAB: 'ACTIVATE_ON_TAB',
}

const PORT_NAME = 'last-form'
const DEFAULT_ACK_TIMEOUT_MS = 3000
const DEFAULT_RESULT_TIMEOUT_MS = 20000

/**
 * Fala com o background por uma conexão persistente (chrome.runtime.connect),
 * não uma mensagem avulsa. Duas vantagens sobre sendMessage de tiro único:
 *
 * 1. Detecção rápida de falha: o background manda um "ack" assim que recebe a
 *    mensagem. Se isso não chegar em `ackTimeoutMs`, sabemos na hora que o
 *    service worker travou/não respondeu - sem esperar o timeout inteiro do
 *    resultado só pra descobrir que nada aconteceu.
 * 2. A conexão aberta mantém o service worker acordado durante a operação
 *    (garantia da própria API do Chrome), em vez de só torcer pra ele não
 *    dormir no meio de uma chamada demorada ao Gemini.
 *
 * `resultTimeoutMs` é reiniciado a cada evento de progresso - ele mede
 * inatividade, não o tempo total da operação, então uma resposta longa que
 * está genuinamente chegando aos poucos (streaming) nunca estoura por conta
 * só de demorar; só estoura se realmente parar de vir dado.
 */
async function sendMessage(
  type,
  payload,
  { ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS, resultTimeoutMs = DEFAULT_RESULT_TIMEOUT_MS, onProgress } = {},
) {
  logEvent('connect', { type })

  return new Promise((resolve, reject) => {
    let settled = false
    let resultTimer = null

    const port = chrome.runtime.connect({ name: PORT_NAME })

    const settle = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(ackTimer)
      clearTimeout(resultTimer)
      port.disconnect()
      fn(value)
    }

    const armResultTimer = () => {
      clearTimeout(resultTimer)
      resultTimer = setTimeout(() => {
        logEvent('timeout', { type, detail: `${resultTimeoutMs / 1000}s sem novidade` })
        settle(reject, new Error(`Sem resposta em ${resultTimeoutMs / 1000}s sem novidade.`))
      }, resultTimeoutMs)
    }

    const ackTimer = setTimeout(() => {
      logEvent('ack-timeout', { type, detail: `${ackTimeoutMs / 1000}s` })
      settle(
        reject,
        new Error(
          `O background não respondeu em ${ackTimeoutMs / 1000}s - provavelmente travou. ` +
            'Recarregue a extensão em chrome://extensions e tente de novo.',
        ),
      )
    }, ackTimeoutMs)

    port.onMessage.addListener((message) => {
      if (message?.ack) {
        logEvent('ack', { type })
        clearTimeout(ackTimer)
        armResultTimer()
        return
      }
      if (message?.progress) {
        logEvent('progress', { type, detail: JSON.stringify(message.progress) })
        armResultTimer()
        onProgress?.(message.progress)
        return
      }
      if (message?.error) {
        logEvent('error', { type, detail: message.error })
        settle(reject, new Error(message.error))
      } else {
        logEvent('result', { type })
        settle(resolve, message?.result)
      }
    })

    port.onDisconnect.addListener(() => {
      logEvent('disconnect', { type })
      settle(reject, new Error('A conexão com a extensão caiu antes de uma resposta.'))
    })

    port.postMessage({ type, payload })
  })
}

export { MESSAGE_TYPES, sendMessage }
