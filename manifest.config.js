import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

export default defineManifest({
  manifest_version: 3,
  name: 'LAST Form',
  description:
    'O último formulário de candidatura que você vai preencher na mão. Preenche a partir do seu currículo, com revisão manual antes de aplicar.',
  version: pkg.version,
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.js',
    type: 'module',
  },
  permissions: ['activeTab', 'scripting', 'storage'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.jsx'],
      run_at: 'document_idle',
    },
  ],
})
