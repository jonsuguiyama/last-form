import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Without this, tests run with the real key from the local .env (a dev-only
// convenience) instead of a clean, predictable environment.
vi.stubEnv('VITE_DEV_GEMINI_API_KEY', '')
