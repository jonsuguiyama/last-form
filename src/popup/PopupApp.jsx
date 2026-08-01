import { useState } from 'react'
import { MESSAGE_TYPES } from '../lib/messaging'

const styles = {
  wrapper: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  title: { fontSize: 14, fontWeight: 600, margin: 0 },
  button: {
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  link: { fontSize: 12, color: '#555', textAlign: 'center', cursor: 'pointer' },
  status: { fontSize: 12, color: '#888' },
}

function PopupApp() {
  const [status, setStatus] = useState('')

  const analyze = async () => {
    setStatus('Abrindo o painel na página…')
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      setStatus('Não achei a aba ativa.')
      return
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.ACTIVATE_ON_TAB })
      window.close()
    } catch {
      setStatus('Recarregue a página e tente de novo (extensão acabou de carregar).')
    }
  }

  return (
    <div style={styles.wrapper}>
      <p style={styles.title}>Job Apply Copilot</p>
      <button type="button" style={styles.button} onClick={analyze}>
        Analisar esta página
      </button>
      {status ? <span style={styles.status}>{status}</span> : null}
      <span style={styles.link} onClick={() => chrome.runtime.openOptionsPage()}>
        Editar meu perfil / currículo
      </span>
    </div>
  )
}

export default PopupApp
