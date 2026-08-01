import { useEffect, useState } from 'react'
import { sendMessage, MESSAGE_TYPES } from '../lib/messaging'
import { normalizeProfile } from '../lib/profileSchema'
import { fileToBase64 } from './resumeUpload'
import styles from './optionsStyles'
import ListEditor from './ListEditor'

const EXPERIENCE_TEMPLATE = { company: '', title: '', startDate: '', endDate: '', current: false, description: '' }
const EDUCATION_TEMPLATE = { institution: '', degree: '', field: '', startDate: '', endDate: '' }
const LANGUAGE_TEMPLATE = { language: '', level: '' }
const MIN_KEY_LENGTH = 20

function hasProfileData(profile) {
  return Boolean(profile.personal.fullName) || profile.experiences.length > 0 || profile.education.length > 0
}

function OptionsApp() {
  const [profile, setProfile] = useState(normalizeProfile())
  // 'editing': input vazio pra digitar uma chave nova. 'locked': chave já salva e
  // verificada, mostrada como status fixo - nunca como campo pré-preenchido.
  const [keyMode, setKeyMode] = useState('editing')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyVerified, setApiKeyVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [profileRevealed, setProfileRevealed] = useState(false)
  const [apiKeyError, setApiKeyError] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [emptyResumeSections, setEmptyResumeSections] = useState([])

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
          // Pré-preenchimento de dev só vale de verdade se for salvo de fato -
          // senão a tela mostra uma chave "pronta" que o background não enxerga.
          await sendMessage(MESSAGE_TYPES.SAVE_API_KEY, devKey)
        }
        try {
          await sendMessage(MESSAGE_TYPES.VERIFY_API_KEY, keyToUse)
          setApiKeyVerified(true)
          setKeyMode('locked') // nunca mostra o campo com bolinhas pra chave já validada
        } catch {
          // chave salva não funciona mais: precisa aparecer editável pra corrigir.
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
    if (!file) return

    setExtracting(true)
    setStatus('⏳ Enviando currículo pro Gemini…')
    try {
      const pdfBase64 = await fileToBase64(file)
      const extracted = await sendMessage(
        MESSAGE_TYPES.PARSE_RESUME,
        { pdfBase64 },
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
      setStatus('Currículo extraído. Revise os campos abaixo e clique em "Salvar perfil" quando estiver pronto.')
    } catch (error) {
      setStatus(`Erro ao extrair o currículo: ${error.message}`)
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
    return <div style={styles.page}>Carregando…</div>
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
          <input type="file" accept="application/pdf" onChange={onResumeSelected} disabled={extracting} />
          {extracting ? <p style={styles.processing}>{status}</p> : null}
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
            <div style={styles.grid2}>
              <input style={styles.input} placeholder="Nome completo" value={profile.personal.fullName} onChange={(e) => updatePersonal('fullName', e.target.value)} />
              <input style={styles.input} placeholder="Email" value={profile.personal.email} onChange={(e) => updatePersonal('email', e.target.value)} />
              <input style={styles.input} placeholder="Telefone" value={profile.personal.phone} onChange={(e) => updatePersonal('phone', e.target.value)} />
              <input style={styles.input} placeholder="Cidade" value={profile.personal.city} onChange={(e) => updatePersonal('city', e.target.value)} />
              <input style={styles.input} placeholder="Endereço" value={profile.personal.address} onChange={(e) => updatePersonal('address', e.target.value)} />
              <input style={styles.input} placeholder="País" value={profile.personal.country} onChange={(e) => updatePersonal('country', e.target.value)} />
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
            {status && !extracting ? <span style={styles.hint}>{status}</span> : null}
          </div>
        </>
      ) : null}
    </div>
  )
}

export default OptionsApp
