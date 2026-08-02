function fieldStatus(field) {
  const filled = field.userValue != null && field.userValue !== ''
  if (filled) return 'ok'
  return field.required ? 'missing-required' : 'missing-optional'
}

const STATUS_LABEL = {
  ok: 'ok',
  'missing-required': 'obrigatório',
  'missing-optional': 'sem dado',
}

function FieldRow({ field, onChange, onToggleSaveAnswer }) {
  const status = fieldStatus(field)
  const wasUnknown = field.proposal?.value == null

  return (
    <div className="japc-field">
      <label className="japc-label">
        {field.label ?? field.name ?? 'Campo sem nome'}
        <span className={`japc-badge ${status}`}>{STATUS_LABEL[status]}</span>
      </label>
      {field.options?.length ? (
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
      ) : (
        <input
          className={`japc-input ${status === 'missing-required' ? 'missing-required' : ''}`}
          value={field.userValue ?? ''}
          placeholder={field.proposal?.missingQuestion ?? ''}
          onChange={(e) => onChange(field.fieldId, e.target.value)}
        />
      )}
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

function ReviewPanel({ fields, phase, blocked, onChangeField, onToggleSaveAnswer, onApply, onNextStep, onClose }) {
  return (
    <div className="japc-panel">
      <div className="japc-header">
        <span>LAST Form</span>
        <button type="button" className="japc-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>

      <div className="japc-body">
        {fields.length === 0 ? (
          <span className="japc-hint">Nenhum campo de formulário encontrado nesta página.</span>
        ) : (
          fields.map((field) => (
            <FieldRow key={field.fieldId} field={field} onChange={onChangeField} onToggleSaveAnswer={onToggleSaveAnswer} />
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
      </div>
    </div>
  )
}

export default ReviewPanel
