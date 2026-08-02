import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.stubEnv('VITE_DEV_GEMINI_API_KEY', '')
