import { normalizeProfile } from './profileSchema'

const PROFILE_KEY = 'japc_profile'
const API_KEY_KEY = 'japc_gemini_api_key'

async function getProfile() {
  const { [PROFILE_KEY]: profile } = await chrome.storage.local.get(PROFILE_KEY)
  return normalizeProfile(profile)
}

async function saveProfile(profile) {
  await chrome.storage.local.set({ [PROFILE_KEY]: normalizeProfile(profile) })
}

async function getApiKey() {
  const { [API_KEY_KEY]: apiKey } = await chrome.storage.local.get(API_KEY_KEY)
  return apiKey ?? ''
}

async function saveApiKey(apiKey) {
  await chrome.storage.local.set({ [API_KEY_KEY]: apiKey })
}

export { getProfile, saveProfile, getApiKey, saveApiKey }
