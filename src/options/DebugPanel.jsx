import { useEffect, useState } from 'react'
import { subscribeToLog, getLogHistory } from '../lib/debugLog'
import styles from './optionsStyles'

const logStyle = {
  maxHeight: 220,
  overflowY: 'auto',
  fontFamily: 'monospace',
  fontSize: 11,
  background: '#fafafa',
  padding: 8,
  borderRadius: 8,
  whiteSpace: 'pre-wrap',
}

function formatEntry(entry) {
  const type = entry.type ? ` (${entry.type})` : ''
  const detail = entry.detail ? `: ${entry.detail}` : ''
  return `[${entry.time}] ${entry.label}${type}${detail}`
}

function DebugPanel() {
  const [entries, setEntries] = useState(getLogHistory)
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeToLog((entry) => setEntries((prev) => [...prev, entry])), [])

  const copyLog = () => {
    navigator.clipboard?.writeText(entries.map(formatEntry).join('\n'))
  }

  return (
    <section style={styles.section}>
      <div style={styles.row}>
        <h2 style={styles.h2}>Diagnóstico</h2>
        <button type="button" style={styles.buttonSecondary} onClick={() => setOpen((prev) => !prev)}>
          {open ? 'Esconder' : `Mostrar (${entries.length})`}
        </button>
        {open ? (
          <button type="button" style={styles.buttonSecondary} onClick={copyLog}>
            Copiar log
          </button>
        ) : null}
      </div>
      {open ? (
        <div style={logStyle}>
          {entries.length === 0 ? (
            <span style={styles.hint}>Nada registrado ainda.</span>
          ) : (
            entries.map((entry, index) => <div key={`${entry.time}-${index}`}>{formatEntry(entry)}</div>)
          )}
        </div>
      ) : null}
    </section>
  )
}

export default DebugPanel
