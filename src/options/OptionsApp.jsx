import { useEffect, useState } from 'react'
import { sendMessage, MESSAGE_TYPES } from '../lib/messaging'
import { normalizeProfile } from '../lib/profileSchema'
import { extractPdfText } from './pdfText'
import styles from './optionsStyles'
import ListEditor from './ListEditor'
import DebugPanel from './DebugPanel'

const EXPERIENCE_TEMPLATE = { company: '', title: '', startDate: '', endDate: '', current: false, description: '' }
const EDUCATION_TEMPLATE = { institution: '', degree: '', field: '', startDate: '', endDate: '' }
const LANGUAGE_TEMPLATE = { language: '', level: '' }
const MIN_KEY_LENGTH = 20
const PERSONAL_FIELDS = [
  { key: 'fullName', placeholder: 'Nome completo' },
  { key: 'email', placeholder: 'Email' },
  { key: 'phone', placeholder: 'Telefone' },
  { key: 'city', placeholder: 'Cidade' },
  { key: 'address', placeholder: 'Endereço' },
  { key: 'country', placeholder: 'País' },
]
const PERSONAL_FIELD_KEYS = PERSONAL_FIELDS.map((field) => field.key)

function hasProfileData(profile) {
  return Boolean(profile.personal.fullName) || profile.experiences.length > 0 || profile.education.length > 0
}

function OptionsApp() {
  const [profile, setProfile] = useState(normalizeProfile())
  const [keyMode, setKeyMode] = useState('editing')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyVerified, setApiKeyVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [profileRevealed, setProfileRevealed] = useState(false)
  const [profileSaveStatus, setProfileSaveStatus] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [resumeFileName, setResumeFileName] = useState('')
  const [emptyResumeSections, setEmptyResumeSections] = useState([])
  const [emptyPersonalFields, setEmptyPersonalFields] = useState([])

  useEffect(() => {
    ;(async () => {
      const [loadedProfile, loadedKey] = await Promise.all([
        sendMessage(MESSAGE_TYPES.GET_PROFILE),
        sendMessage(MESSAGE_TYPES.GET_API_KEY),
      ])
      const normalized = normalizeProfile(loadedProfile)
      setProfile(normalized)
      setProfileRevealed(hasProfileData(normalized))

      const devKey = import.meta.env.VITE_DEV_GEMINI_API_KEY || ''
      const keyToUse = loadedKey || devKey
      if (keyToUse) {
        if (!loadedKey) {
          await sendMessage(MESSAGE_TYPES.SAVE_API_KEY, devKey)
        }
        try {
          await sendMessage(MESSAGE_TYPES.VERIFY_API_KEY, keyToUse)
          setApiKeyVerified(true)
          setKeyMode('locked')
        } catch {
          setApiKeyVerified(false)
          setApiKey(keyToUse)
          setKeyMode('editing')
        }
      }
      setLoading(false)
    })()
  }, [])

  const saveProfile = async (next) => {
    setProfile(next)
    await sendMessage(MESSAGE_TYPES.SAVE_PROFILE, next)
    setProfileSaveStatus('Perfil salvo.')
    setTimeout(() => setProfileSaveStatus(''), 2500)
  }

  const verifyAndSaveApiKey = async () => {
    setVerifying(true)
    setApiKeyError('')
    try {
      await sendMessage(MESSAGE_TYPES.VERIFY_API_KEY, apiKey)
      await sendMessage(MESSAGE_TYPES.SAVE_API_KEY, apiKey)
      setApiKeyVerified(true)
      setKeyMode('locked')
      setApiKey('')
    } catch (error) {
      setApiKeyVerified(false)
      setApiKeyError(error.message)
    } finally {
      setVerifying(false)
    }
  }

  const startEditingApiKey = () => {
    setApiKey('')
    setApiKeyError('')
    setKeyMode('editing')
  }

  const onResumeSelected = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setExtracting(true)
    setResumeError('')
    setResumeFileName(file.name)
    setStatus('⏳ Lendo o PDF localmente…')
    try {
      const resumeText = await extractPdfText(file)
      setStatus('⏳ Enviando currículo pro Gemini…')
      const extracted = await sendMessage(
        MESSAGE_TYPES.PARSE_RESUME,
        { resumeText },
        {
          resultTimeoutMs: 30000,
          onProgress: (progress) => {
            if (progress.type === 'queue') {
              setStatus(`⏳ Na fila do Gemini (posição ${progress.position} de ${progress.total})…`)
            } else if (progress.type === 'stream') {
              setStatus(`⏳ Recebendo resposta do Gemini… (${progress.charsReceived} caracteres)`)
            }
          },
        },
      )
      const merged = normalizeProfile({ ...profile, ...extracted })
      setProfile(merged)
      setProfileRevealed(true)

      const empties = ['experiences', 'education', 'skills', 'languages'].filter(
        (key) => (merged[key]?.length ?? 0) === 0,
      )
      setEmptyResumeSections(empties)

      const emptyPersonal = PERSONAL_FIELD_KEYS.filter((key) => !merged.personal[key])
      setEmptyPersonalFields(emptyPersonal)

      setStatus(
        emptyPersonal.length > 0 || empties.length > 0
          ? 'Currículo extraído, mas alguns campos ficaram vazios (marcados em laranja abaixo). Revise e complete antes de salvar.'
          : 'Currículo extraído. Revise os campos abaixo e clique em "Salvar perfil" quando estiver pronto.',
      )
    } catch (error) {
      setStatus('')
      setResumeError(error.message)
    } finally {
      setExtracting(false)
    }
  }

  const updatePersonal = (field, value) => {
    setProfile((prev) => ({ ...prev, personal: { ...prev.personal, [field]: value } }))
  }

  const updateLink = (field, value) => {
    setProfile((prev) => ({ ...prev, personal: { ...prev.personal, links: { ...prev.personal.links, [field]: value } } }))
  }

  const updateList = (key, index, patch) => {
    setProfile((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const addListItem = (key, template) => {
    setProfile((prev) => ({ ...prev, [key]: [...prev[key], { ...template }] }))
  }

  const removeListItem = (key, index) => {
    setProfile((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }))
  }

  if (loading) {
    return (
      <div style={styles.page}>
        Carregando…
        <DebugPanel />
      </div>
    )
  }

  const apiKeyTooShort = apiKey.trim().length < MIN_KEY_LENGTH
  const saveButtonDisabled = apiKeyTooShort || verifying

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>LAST Form - Perfil</h1>
      <p style={styles.subtitle}>
        Esses dados ficam só no seu navegador (chrome.storage.local) e são usados pra preencher formulários de
        candidatura. Nada é enviado a lugar nenhum além da API do Gemini quando você aciona uma análise.
      </p>

      <section style={styles.section}>
        <h2 style={styles.h2}>API key do Gemini</h2>

        {keyMode === 'locked' ? (
          <div style={styles.row}>
            <p style={styles.success}>✓ Chave configurada e verificada.</p>
            <button type="button" style={styles.buttonSecondary} onClick={startEditingApiKey}>
              Trocar chave
            </button>
          </div>
        ) : (
          <>
            <p style={styles.hint}>
              Gere uma gratuita em{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>
              .
            </p>
            <p style={styles.hint}>
              Sempre usamos o modelo Gemini Flash mais recente disponível pra sua chave (hoje resolve pro
              gemini-3.6-flash) - o Google aposenta modelos antigos com frequência, então não travamos numa versão
              fixa que pode parar de funcionar sozinha.
            </p>
            <div style={styles.row}>
              <input
                type="password"
                style={styles.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza…"
                autoFocus
              />
              <button
                type="button"
                style={saveButtonDisabled ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
                disabled={saveButtonDisabled}
                onClick={verifyAndSaveApiKey}
              >
                {verifying ? 'Verificando…' : 'Salvar'}
              </button>
            </div>
            {apiKeyTooShort && apiKey.length > 0 ? (
              <p style={styles.hint}>Cole a chave inteira - parece curta demais ainda.</p>
            ) : null}
            {verifying ? <p style={styles.processing}>⏳ Verificando chave com a API do Gemini…</p> : null}
            {apiKeyError ? <p style={styles.warning}>⚠ Chave não funcionou: {apiKeyError}</p> : null}
          </>
        )}
      </section>

      {apiKeyVerified ? (
        <section style={styles.section}>
          <h2 style={styles.h2}>Currículo</h2>
          <p style={styles.hint}>Suba o PDF uma vez: os dados extraídos populam as seções abaixo, editáveis.</p>
          <div style={styles.row}>
            <input type="file" accept="application/pdf" onChange={onResumeSelected} disabled={extracting} />
            {resumeFileName ? <span style={styles.hint}>{resumeFileName}</span> : null}
          </div>
          {status ? <p style={styles.processing}>{status}</p> : null}
          {resumeError ? <p style={styles.warning}>⚠ Erro ao extrair o currículo: {resumeError}</p> : null}
          {emptyResumeSections.length > 0 ? (
            <p style={styles.warning}>
              Seções não encontradas no PDF: {emptyResumeSections.join(', ')}. Preencha manualmente se fizer sentido.
            </p>
          ) : null}
        </section>
      ) : null}

      {profileRevealed ? (
        <>
          <section style={styles.section}>
            <h2 style={styles.h2}>Dados pessoais</h2>
            {emptyPersonalFields.length > 0 ? (
              <p style={styles.warning}>Campos em laranja não vieram do PDF - preencha ou confirme.</p>
            ) : null}
            <div style={styles.grid2}>
              {PERSONAL_FIELDS.map(({ key, placeholder }) => (
                <input
                  key={key}
                  style={emptyPersonalFields.includes(key) ? { ...styles.input, ...styles.inputMissing } : styles.input}
                  placeholder={placeholder}
                  value={profile.personal[key]}
                  onChange={(e) => updatePersonal(key, e.target.value)}
                />
              ))}
              <input style={styles.input} placeholder="LinkedIn" value={profile.personal.links.linkedin} onChange={(e) => updateLink('linkedin', e.target.value)} />
              <input style={styles.input} placeholder="GitHub" value={profile.personal.links.github} onChange={(e) => updateLink('github', e.target.value)} />
              <input style={styles.input} placeholder="Portfólio" value={profile.personal.links.portfolio} onChange={(e) => updateLink('portfolio', e.target.value)} />
            </div>
          </section>

          <ListEditor
            title="Experiências profissionais"
            items={profile.experiences}
            template={EXPERIENCE_TEMPLATE}
            onAdd={() => addListItem('experiences', EXPERIENCE_TEMPLATE)}
            onRemove={(i) => removeListItem('experiences', i)}
            onChange={(i, patch) => updateList('experiences', i, patch)}
            fields={[
              { key: 'company', placeholder: 'Empresa' },
              { key: 'title', placeholder: 'Cargo' },
              { key: 'startDate', placeholder: 'Início (AAAA-MM)' },
              { key: 'endDate', placeholder: 'Fim (AAAA-MM)' },
              { key: 'description', placeholder: 'Descrição', multiline: true },
            ]}
          />

          <ListEditor
            title="Educação"
            items={profile.education}
            template={EDUCATION_TEMPLATE}
            onAdd={() => addListItem('education', EDUCATION_TEMPLATE)}
            onRemove={(i) => removeListItem('education', i)}
            onChange={(i, patch) => updateList('education', i, patch)}
            fields={[
              { key: 'institution', placeholder: 'Instituição' },
              { key: 'degree', placeholder: 'Grau (ex: Bacharelado)' },
              { key: 'field', placeholder: 'Área' },
              { key: 'startDate', placeholder: 'Início (AAAA-MM)' },
              { key: 'endDate', placeholder: 'Fim (AAAA-MM)' },
            ]}
          />

          <section style={styles.section}>
            <h2 style={styles.h2}>Habilidades</h2>
            <input
              style={styles.input}
              placeholder="Separadas por vírgula"
              value={profile.skills.join(', ')}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))
              }
            />
          </section>

          <ListEditor
            title="Idiomas"
            items={profile.languages}
            template={LANGUAGE_TEMPLATE}
            onAdd={() => addListItem('languages', LANGUAGE_TEMPLATE)}
            onRemove={(i) => removeListItem('languages', i)}
            onChange={(i, patch) => updateList('languages', i, patch)}
            fields={[
              { key: 'language', placeholder: 'Idioma' },
              { key: 'level', placeholder: 'Nível' },
            ]}
          />

          <section style={styles.section}>
            <h2 style={styles.h2}>Respostas aprendidas</h2>
            <p style={styles.hint}>Salvas automaticamente quando você responde um campo que faltava e marca "salvar".</p>
            {profile.customQA.length === 0 ? (
              <p style={styles.hint}>Nenhuma ainda.</p>
            ) : (
              profile.customQA.map((qa, i) => (
                <div style={styles.row} key={`${qa.questionPattern}-${i}`}>
                  <span style={styles.readonlyItem}>
                    <strong>{qa.questionPattern}</strong> → {qa.answer}
                  </span>
                  <button type="button" style={styles.buttonSecondary} onClick={() => removeListItem('customQA', i)}>
                    Remover
                  </button>
                </div>
              ))
            )}
          </section>

          <section style={styles.section}>
            <h2 style={styles.h2}>Vínculos campo → currículo</h2>
            <p style={styles.hint}>Fixados manualmente no painel de revisão durante uma candidatura.</p>
            {profile.fieldBindings.length === 0 ? (
              <p style={styles.hint}>Nenhum ainda.</p>
            ) : (
              profile.fieldBindings.map((b, i) => (
                <div style={styles.row} key={`${b.labelPattern}-${i}`}>
                  <span style={styles.readonlyItem}>
                    <strong>{b.labelPattern}</strong> → {b.profilePath}
                  </span>
                  <button type="button" style={styles.buttonSecondary} onClick={() => removeListItem('fieldBindings', i)}>
                    Remover
                  </button>
                </div>
              ))
            )}
          </section>

          <div style={styles.stickyFooter}>
            <button type="button" style={styles.button} onClick={() => saveProfile(profile)}>
              Salvar perfil
            </button>
            {profileSaveStatus ? <span style={styles.success}>{profileSaveStatus}</span> : null}
          </div>
        </>
      ) : null}

      <DebugPanel />
    </div>
  )
}

export default OptionsApp
