# LAST Form

[![License](https://img.shields.io/github/license/jonsuguiyama/last-form)](https://github.com/jonsuguiyama/last-form/blob/main/LICENSE)

O último formulário de candidatura que você vai precisar preencher!

Extensão Chrome que ajuda a preencher formulários de candidatura a vaga a partir do
seu currículo. É universal (funciona em qualquer site, não só ATS conhecidos como
Gupy/LinkedIn), usando o Gemini (free tier) pra mapear campos e adaptar textos a
limites de caracteres. **Nunca envia uma candidatura sozinha**: sempre mostra um
painel de revisão editável antes de escrever qualquer coisa na página, e o botão
final de "enviar" é sempre seu.

## Como funciona

1. **Perfil**: você sobe seu currículo em PDF na tela de Opções, o Gemini extrai os
   dados estruturados (experiências, educação, skills...) e você revisa/edita antes
   de salvar. Fica só em `chrome.storage.local`, no seu navegador.
2. **Análise**: em qualquer página de vaga, clique no ícone da extensão. Um content
   script escaneia os campos do formulário (label, tipo, limite de caracteres,
   obrigatoriedade) e manda pro background, que resolve o que já tem salvo
   localmente (`fieldBindings`/`customQA`) e pede ao Gemini o resto.
3. **Revisão**: um painel é injetado na própria página (Shadow DOM, não conflita com
   o CSS do site) mostrando o valor proposto por campo, editável. Campos que faltam
   dado no perfil ficam em destaque: obrigatórios bloqueiam o botão de preencher até
   você responder.
4. **Preenchimento**: só depois que você clica em "Preencher formulário" é que os
   valores são escritos na página de verdade. Seções dinâmicas ("+ Adicionar
   experiência") e formulários em várias etapas são tratados automaticamente,
   sempre com o mesmo ciclo de revisão a cada etapa nova.
5. **Envio**: a extensão nunca clica no botão final de candidatura. Isso é sempre
   manual, por design.

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

## O que ainda depende de teste com formulários reais

A heurística de detecção de labels, limites de caractere, botões de "+ Adicionar" e
"próxima etapa" foi desenhada a partir de padrões comuns, mas não foi validada
contra um navegador real ainda. Conforme você for aplicando pra vagas de verdade,
guarde exemplos (print e, se for fácil, o HTML do formulário via DevTools → Copy
outerHTML) numa pasta `fixtures/`. Isso vira a base pra ajustar as heurísticas e os
prompts do Gemini com casos reais em vez de suposições.

## Segurança

- Perfil e API key ficam só em `chrome.storage.local` (nunca saem do seu navegador,
  exceto as chamadas que você mesmo aciona pra API do Gemini).
- `.env` é usado só como conveniência em desenvolvimento (pré-preenche o campo de
  API key na tela de Opções) e está no `.gitignore`: nunca é commitado nem vai pro
  bundle de produção.
- A extensão nunca clica no botão final de envio de um formulário: isso é sempre
  uma ação manual sua.

## Próximo passo: publicar

Hoje isso roda só como extensão "unpacked" (carregada manualmente via
`chrome://extensions`). O lugar certo pra distribuir pra outras pessoas é a
**Chrome Web Store** (`chromewebstore.google.com`), não a Google Play Store: a
Play Store é pra apps Android, extensões de navegador (Chrome, Edge, Brave...)
vão na Chrome Web Store. Publicar lá exige criar uma conta de desenvolvedor
(taxa única de $5) e passar pela revisão do Google, então antes disso vale
validar bem em uso real e ajustar as heurísticas com os `fixtures/` reais.

## License

MIT — see [LICENSE](./LICENSE).
