import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Sem isso, testes rodam com a chave real do .env local (usada só como
// conveniência de dev) em vez de um ambiente limpo e previsível.
vi.stubEnv('VITE_DEV_GEMINI_API_KEY', '')
