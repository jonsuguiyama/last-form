import { useCallback, useEffect, useState } from 'react'
import ReviewPanel from './ReviewPanel'
import {
  analyzeCurrentStep,
  expandSection,
  applyFields,
  hasBlockingRequiredField,
  findNextStep,
} from './reviewController'
import { clickAndWait } from '../lib/domWait'
import { sendMessage, MESSAGE_TYPES } from '../lib/messaging'

async function persistSavedAnswers(fields) {
  const toSave = fields.filter((f) => f.saveAsAnswer && f.userValue)
  if (toSave.length === 0) return

  const profile = await sendMessage(MESSAGE_TYPES.GET_PROFILE)
  const customQA = [
    ...profile.customQA,
    ...toSave.map((f) => ({ questionPattern: f.label ?? f.name ?? 'pergunta sem label', answer: f.userValue })),
  ]
  await sendMessage(MESSAGE_TYPES.SAVE_PROFILE, { ...profile, customQA })
}

function withUserValue(field) {
  return { ...field, userValue: field.proposal?.value ?? '' }
}

function App() {
  const [phase, setPhase] = useState('idle')
  const [fields, setFields] = useState([])
  const [addButtons, setAddButtons] = useState({})
  const [error, setError] = useState(null)

  const start = useCallback(async () => {
    setPhase('analyzing')
    setError(null)
    try {
      const { fields: analyzed, addButtons: buttons } = await analyzeCurrentStep()
      setFields(analyzed.map(withUserValue))
      setAddButtons(buttons)
      setPhase('reviewing')
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    const listener = (message, _sender, sendResponse) => {
      if (message?.type === MESSAGE_TYPES.ACTIVATE_ON_TAB) {
        start()
        sendResponse({ result: true })
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [start])

  const onChangeField = useCallback((fieldId, value) => {
    setFields((prev) => prev.map((f) => (f.fieldId === fieldId ? { ...f, userValue: value } : f)))
  }, [])

  const onToggleSaveAnswer = useCallback((fieldId, checked) => {
    setFields((prev) => prev.map((f) => (f.fieldId === fieldId ? { ...f, saveAsAnswer: checked } : f)))
  }, [])

  const blocked = hasBlockingRequiredField(fields)

  const onApply = useCallback(async () => {
    if (hasBlockingRequiredField(fields)) return
    setPhase('applying')
    try {
      applyFields(fields)
      await persistSavedAnswers(fields)

      const profile = await sendMessage(MESSAGE_TYPES.GET_PROFILE)
      for (const [sectionKey, buttonEl] of Object.entries(addButtons)) {
        const count = profile[sectionKey]?.length ?? 0
        if (count === 0) continue

        const expanded = await expandSection(buttonEl, count, sectionKey)
        const prepared = expanded.map(withUserValue)

        if (hasBlockingRequiredField(prepared)) {
          setFields((prev) => [...prev, ...prepared])
          setPhase('reviewing')
          return
        }
        applyFields(prepared)
      }

      setPhase(findNextStep() ? 'step-complete' : 'done')
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }, [fields, addButtons])

  const onNextStep = useCallback(async () => {
    const nextButton = findNextStep()
    if (!nextButton) return
    setPhase('analyzing')
    await clickAndWait(nextButton, { scopeEl: document.body, quietPeriodMs: 300, timeoutMs: 5000 })
    await start()
  }, [start])

  if (phase === 'idle') {
    return (
      <button type="button" className="japc-launcher" onClick={start}>
        Analisar formulário
      </button>
    )
  }

  if (phase === 'error') {
    return (
      <div className="japc-panel">
        <div className="japc-header">
          <span>Job Apply Copilot</span>
          <button type="button" className="japc-close" onClick={() => setPhase('idle')} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="japc-body">
          <span className="japc-hint">Erro: {error}</span>
        </div>
      </div>
    )
  }

  return (
    <ReviewPanel
      fields={fields}
      phase={phase}
      blocked={blocked}
      onChangeField={onChangeField}
      onToggleSaveAnswer={onToggleSaveAnswer}
      onApply={onApply}
      onNextStep={onNextStep}
      onClose={() => setPhase('idle')}
    />
  )
}

export default App
