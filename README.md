# LAST Form

<img src="public/icons/icon128.png" alt="LAST Form" width="64" />

[![License](https://img.shields.io/github/license/jonsuguiyama/last-form)](https://github.com/jonsuguiyama/last-form/blob/main/LICENSE)

O último formulário de candidatura que você vai precisar preencher!

Extensão Chrome que ajuda a preencher formulários de candidatura a vaga a partir do
seu currículo. É universal (funciona em qualquer site, não só ATS conhecidos como
Gupy/LinkedIn), usando o Gemini (free tier) pra mapear campos e adaptar textos a
limites de caracteres. **Nunca envia uma candidatura sozinho**: sempre mostra um
painel de revisão editável antes de escrever qualquer coisa na página, e o botão
final de "enviar" é sempre seu.

## Como funciona

1. **Perfil**: você sobe seu currículo em PDF na tela de Opções. Um parser local
   (`pdf.js`, sem enviar o binário pra fora) destrincha o PDF, extrai o texto e os
   links, e só então esse conteúdo limpo é mandado pro Gemini, que extrai os dados
   estruturados (experiências, educação, skills...). Você revisa/edita antes de
   salvar, e tudo fica só em `chrome.storage.local`, no seu navegador.
2. **Análise**: em qualquer página de vaga, clique em "Analisar formulário". Um
   content script escaneia os campos do formulário (label, tipo, limite de
   caracteres, obrigatoriedade) e manda pro background, que resolve o que já tem
   salvo localmente (`fieldBindings`/`customQA`) e pede ao Gemini o resto.
3. **Revisão**: um painel é injetado na própria página (Shadow DOM, não conflita com
   o CSS do site) mostrando o valor proposto por campo, editável. Campos onde faltam
   dados no perfil ficam em destaque, e campos obrigatórios bloqueiam o botão de
   preencher até você responder. Se o formulário pedir algo que não está no seu
   currículo, você preenche ali mesmo, e a resposta fica salva pra ser reaproveitada
   em outros formulários no futuro.
4. **Preenchimento**: só depois que você clica em "Preencher formulário" é que os
   valores são escritos na página de verdade. Seções dinâmicas ("+ Adicionar
   experiência") e formulários em várias etapas são tratados automaticamente,
   sempre com o mesmo ciclo de revisão a cada etapa nova.
5. **Envio**: a extensão nunca clica no botão final de candidatura. Isso é sempre
   manual, por design.

Como a ferramenta ainda está em desenvolvimento, ainda existem alguns edge cases
pra trabalhar.

## Rodando localmente

```bash
npm install
npm run dev     # build com watch, pra carregar como unpacked e ter HMR
npm run build   # build de produção em dist/
npm test        # roda a suíte de testes (vitest)
```

## Carregando no Chrome

1. Rode `npm run build` (ou `npm run dev` pra desenvolvimento com hot-reload).
2. Abra `chrome://extensions`.
3. Ative o "Modo de desenvolvedor" (canto superior direito).
4. Clique em "Carregar sem compactação" ("Load unpacked") e selecione a pasta `dist/`.
5. Clique no ícone da extensão → "Editar meu perfil / currículo" pra abrir a tela de
   Opções, colar sua API key do Gemini (gratuita em
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) e subir seu
   currículo em PDF.
6. Em qualquer página com formulário de candidatura, clique no ícone da extensão →
   "Analisar esta página".

## Estrutura

Ver comentários em cada módulo de `src/lib/`: cada um tem uma responsabilidade
única (scanner de DOM, espera de DOM, motor de preenchimento, navegação de wizard,
seções dinâmicas, cliente do Gemini, schema/matching do perfil).

## Segurança

- Perfil e API key ficam só em `chrome.storage.local` (nunca saem do seu navegador,
  exceto as chamadas que você mesmo aciona pra API do Gemini).
- `.env` é usado só como conveniência em desenvolvimento (pré-preenche o campo de
  API key na tela de Opções) e está no `.gitignore`: nunca é commitado nem vai pro
  bundle de produção.
- A extensão nunca clica no botão final de envio de um formulário: isso é sempre
  uma ação manual sua.
- É basicamente o mesmo modelo de confiança do autocompletar nativo do navegador:
  os dados ficam guardados localmente e só são usados pra preencher campos na
  própria página, sob demanda sua. A diferença é que aqui o preenchimento é
  inteligente (entende o contexto de cada campo em vez de só bater com o nome do
  input) e sempre passa por uma revisão editável antes de ir pra página.

## Próximo passo

Hoje isso roda só como extensão "unpacked" (carregada manualmente via
`chrome://extensions`). O próximo passo seria disponibilizar essa extensão na
Chrome Web Store, o que exige criar uma conta de desenvolvedor e passar pela
revisão do Google. Vou fazer isso assim que tiver uma versão digna e funcionando
de maneira bem satisfatória.

## Contribuindo

Esse projeto é pequeno e ainda em desenvolvimento, mas contribuições são muito
bem-vindas! Se você quiser ajudar, seja com uma correção de bug, uma heurística
nova pra algum tipo de formulário que não é bem detectado, ou até uma ideia de
feature, sinta-se à vontade pra abrir uma issue ou mandar um PR. Antes de mandar
código, rode `npm test` pra garantir que a suíte continua passando.

## License

MIT — see [LICENSE](./LICENSE).
