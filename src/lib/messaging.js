const MESSAGE_TYPES = {
  MAP_FIELDS: 'MAP_FIELDS',
  ADAPT_TEXT: 'ADAPT_TEXT',
  PARSE_RESUME: 'PARSE_RESUME',
  GET_PROFILE: 'GET_PROFILE',
  SAVE_PROFILE: 'SAVE_PROFILE',
  GET_API_KEY: 'GET_API_KEY',
  SAVE_API_KEY: 'SAVE_API_KEY',
  ACTIVATE_ON_TAB: 'ACTIVATE_ON_TAB',
}

/**
 * Wrapper fino sobre chrome.runtime.sendMessage: rejeita a Promise quando o
 * handler no outro lado responde com { error }, em vez de deixar isso silencioso.
 */
async function sendMessage(type, payload) {
  const response = await chrome.runtime.sendMessage({ type, payload })
  if (response?.error) {
    throw new Error(response.error)
  }
  return response?.result
}

export { MESSAGE_TYPES, sendMessage }
