import { useEffect, useState } from 'react'
import { subscribeToLog, getLogHistory } from '../lib/debugLog'

function formatLogEntry(entry) {
  const type = entry.type ? ` (${entry.type})` : ''
  const detail = entry.detail ? `: ${entry.detail}` : ''
  return `[${entry.time}] ${entry.label}${type}${detail}`
}

function DebugSection() {
  const [entries, setEntries] = useState(getLogHistory)
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeToLog((entry) => setEntries((prev) => [...prev, entry])), [])

  return (
    <div className="japc-debug">
      <button type="button" className="japc-close" style={{ fontSize: 11 }} onClick={() => setOpen((prev) => !prev)}>
        {open ? 'Esconder diagnóstico' : `Diagnóstico (${entries.length})`}
      </button>
      {open ? (
        <div className="japc-debug-log">
          {entries.length === 0 ? (
            <span className="japc-hint">Nada registrado ainda.</span>
          ) : (
            entries.map((entry, index) => <div key={`${entry.time}-${index}`}>{formatLogEntry(entry)}</div>)
          )}
        </div>
      ) : null}
    </div>
  )
}

function fieldStatus(field) {
  if (field.type === 'checkbox') return 'ok'
  const filled = field.userValue != null && field.userValue !== ''
  if (filled) return 'ok'
  return field.required ? 'missing-required' : 'missing-optional'
}

const STATUS_LABEL = {
  ok: 'ok',
  'missing-required': 'obrigatório',
  'missing-optional': 'sem dado',
}

const IS_GROUP_FIELD = new Set(['radio-group', 'button-group'])

function fieldDisplayLabel(field) {
  if (field.label) return field.label
  if (!IS_GROUP_FIELD.has(field.tag) && field.name) return field.name
  return 'Pergunta não identificada'
}

function CheckboxControl({ field, onChange }) {
  return (
    <label className="japc-checkbox-row">
      <input
        type="checkbox"
        checked={field.userValue === true}
        onChange={(e) => onChange(field.fieldId, e.target.checked)}
      />
      {field.userValue === true ? 'Marcado' : 'Não marcado'}
    </label>
  )
}

function SelectControl({ field, status, onChange }) {
  return (
    <select
      className={`japc-input ${status === 'missing-required' ? 'missing-required' : ''}`}
      value={field.userValue ?? ''}
      onChange={(e) => onChange(field.fieldId, e.target.value)}
    >
      <option value="">Selecione…</option>
      {field.options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function TextControl({ field, status, onChange }) {
  return (
    <input
      className={`japc-input ${status === 'missing-required' ? 'missing-required' : ''}`}
      value={field.userValue ?? ''}
      placeholder={field.proposal?.missingQuestion ?? ''}
      onChange={(e) => onChange(field.fieldId, e.target.value)}
    />
  )
}

function FieldControl({ field, status, onChange }) {
  if (field.type === 'checkbox') return <CheckboxControl field={field} onChange={onChange} />
  if (field.options?.length) return <SelectControl field={field} status={status} onChange={onChange} />
  return <TextControl field={field} status={status} onChange={onChange} />
}

function FieldRow({ field, onChange, onToggleSaveAnswer, onDismiss }) {
  const status = fieldStatus(field)
  const wasUnknown = field.proposal?.value == null

  return (
    <div className="japc-field">
      <div className="japc-field-header">
        <label className="japc-label">
          {fieldDisplayLabel(field)}
          <span className={`japc-badge ${status}`}>{STATUS_LABEL[status]}</span>
        </label>
        <button
          type="button"
          className="japc-close"
          onClick={() => onDismiss(field.fieldId)}
          aria-label="Remover este campo, não faz sentido pra mim"
          title="Remover, não faz sentido pra mim"
        >
          ×
        </button>
      </div>
      <FieldControl field={field} status={status} onChange={onChange} />
      {field.charLimit ? (
        <span className="japc-hint">
          {(field.userValue ?? '').length}/{field.charLimit.max} caracteres
        </span>
      ) : null}
      {wasUnknown ? (
        <label className="japc-checkbox-row">
          <input
            type="checkbox"
            checked={field.saveAsAnswer ?? false}
            onChange={(e) => onToggleSaveAnswer(field.fieldId, e.target.checked)}
          />
          salvar essa resposta pro perfil, pra próxima vez
        </label>
      ) : null}
    </div>
  )
}

function ReviewPanel({
  fields,
  phase,
  blocked,
  onChangeField,
  onToggleSaveAnswer,
  onDismissField,
  onApply,
  onNextStep,
  onClose,
}) {
  return (
    <div className="japc-panel">
      <div className="japc-header">
        <span>LAST Form</span>
        <button type="button" className="japc-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>

      <div className="japc-body">
        {phase === 'analyzing' ? (
          <span className="japc-hint">⏳ Analisando a página…</span>
        ) : fields.length === 0 ? (
          <span className="japc-hint">Nenhum campo de formulário encontrado nesta página.</span>
        ) : (
          fields.map((field) => (
            <FieldRow
              key={field.fieldId}
              field={field}
              onChange={onChangeField}
              onToggleSaveAnswer={onToggleSaveAnswer}
              onDismiss={onDismissField}
            />
          ))
        )}
      </div>

      <div className="japc-footer">
        {phase === 'step-complete' ? (
          <button type="button" className="japc-button primary" onClick={onNextStep}>
            Ir para próxima etapa →
          </button>
        ) : phase === 'done' ? (
          <span className="japc-note">
            Preenchido. Revise os campos na página e envie a candidatura você mesmo quando estiver pronto.
          </span>
        ) : (
          <button
            type="button"
            className="japc-button primary"
            disabled={fields.length === 0 || blocked || phase === 'applying' || phase === 'analyzing'}
            onClick={onApply}
          >
            {phase === 'analyzing' ? 'Analisando…' : phase === 'applying' ? 'Preenchendo…' : 'Preencher formulário'}
          </button>
        )}
        {blocked ? (
          <span className="japc-note">Responda os campos obrigatórios em destaque antes de continuar.</span>
        ) : null}
        <span className="japc-note">Nada é enviado automaticamente. O botão final é sempre seu.</span>
        <DebugSection />
      </div>
    </div>
  )
}

export default ReviewPanel
