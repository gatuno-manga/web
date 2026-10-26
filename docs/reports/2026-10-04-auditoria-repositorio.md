# Auditoria Técnica — repositório `gatuno/web` (transversal)

**Data:** 2026-10-04 · **Branch:** `developer` · **Commit base:** `864a1e3`
**Escopo:** segurança, SSR, autenticação, dependências, sincronização/offline, arquitetura de serviços,
testes, CI, build e higiene do repositório — tudo o que os relatórios por módulo não cobrem
**Relatórios irmãos:** [`chapters`](./2026-08-23-chapters-performance-usability.md) ·
[`readers`](./2026-08-23-readers-performance-usability.md) ·
[`inputs-atoms`](./2026-08-23-inputs-atoms-performance-usability.md) ·
[`book-grid/context-menu/item-book`](./2026-08-23-book-grid-context-menu-item-book-performance-usability.md) ·
[`micro-interações`](./2026-08-23-micro-interacoes-animacoes-blur.md)

---

## 1. Sumário executivo

O Gatuno web tem uma base de tipagem e de componentes que a maioria dos projetos Angular não tem:
`strict` + `strictTemplates`, **zero** `any` em produção, 78 de 78 componentes `OnPush`, *zoneless*
no build. Esse cuidado **não chega** às camadas que sustentam o produto. As dependências de
segurança estão paradas há quatro meses numa versão com um advisory **crítico**. O token de sessão é
legível por qualquer script, e há um caminho de XSS armazenado que o entrega. A configuração de SSR
declara um comportamento que o runtime nunca executa. A sincronização de progresso, que é a
funcionalidade central de um leitor, perde e regride dados em cenários comuns. E o CI está vermelho
há três *pushes* sem que isso tenha bloqueado nada.

| # | Problema | Alcance | Severidade |
|---|---|---|---|
| S-01 | 26 vulnerabilidades em dependências de produção, 1 crítica no `@angular/ssr` (SSRF/Host header); a correção está dentro do *range* `^21` e não foi aplicada | Todos | Crítica |
| S-02 + S-03 | XSS armazenado no leitor de texto HTML + JWT em cookie legível por JS, sem `Secure`, sem CSP → roubo de sessão | Leitores de capítulos HTML | Alta |
| C-02 + C-05 | Progresso entre dispositivos regride ou se perde (corrida no `getProgress`, `lastSyncAt` ambíguo, debounce sem *flush*) | Usuários logados | Alta |
| U-01 | Voltar a rede recarrega a página inteira — **reproduzido** no leitor | Celular / rede instável | Alta |
| U-02 | Página do livro publica `canonical` e `og:url` para `https://example.com` — **medido** | SEO de todo o catálogo | Alta |
| Q-01 | CI vermelho no HEAD (6 falhas), e o commit seguinte entrou por cima | Processo | Alta |
| C-01 | `renderMode`/`cache` das rotas é configuração morta: tudo passa por SSR, nenhum cache existe | Servidor | Alta |

**Veredicto:** código de componente acima da média, infraestrutura de produto abaixo dela. O risco
dominante não é de performance. É de **confiança**: na segurança da sessão, na integridade do
progresso de leitura e no próprio CI, que hoje não impede regressão alguma.

---

## 2. Metodologia e limites

### 2.1 O que foi feito

- **Leitura e busca.** Leitura integral de `server.ts`, `app.config*.ts`, `app.routes.ts`,
  interceptors, `user-token`, `auth`, `mqtt`, `reading-progress*`, `download`, `custom-sw.js`, CI,
  Dockerfiles e configs. Três varreduras paralelas por área: segurança/SSR, serviços/estado e
  testes/tooling. Toda linha citada aqui foi reaberta nesta sessão.
- **Build e testes.** Build de produção real:
  `npx ng build --configuration production`, exit 0, 7,8 s. Foi chamado direto para não disparar o
  `prebuild`, que reescreve o `icons.constant.ts` versionado. Suíte completa:
  `npx ng test --browsers=ChromeHeadlessCI --watch=false`, exit 1.
- **Auditoria de dependências.** `npm audit --omit=dev --json` e `npm outdated`.
- **SSR de produção.** `node dist/front/server/server.mjs` na porta 4100, com testes de cabeçalho via
  `curl` (Host forjado, `X-Forwarded-Host`, `Accept-Encoding`, asset inexistente, rota inexistente)
  e um teste de memória com 12.000 URLs únicas.
- **Navegador.** Chrome via DevTools MCP:
  - visitante anônimo em contexto isolado e frio, no build de produção;
  - Lighthouse mobile (acessibilidade/SEO/boas práticas);
  - sessão logada pelo próprio usuário no dev server `:4200`, para cookies, metatags, reconexão e
    rota inexistente.
- **Lint e código morto.** `npx biome check .` e `npx knip`, ambos sem `--write`.
- **Pesquisa.** Advisories GHSA, documentação do Angular via Context7, Express, mqtt.js, MDN, OWASP,
  GitHub Docs e README do Karma, listados na seção 13.

### 2.2 O que NÃO foi feito — limites desta análise

> **Nenhum trace de performance com dados reais.** O CORS da API local só aceita `:4200`, então a
> home de produção (`:4100`) carregou sem dados; um trace ali mediria um estado vazio. O Lighthouse
> rodou só nas categorias que a ferramenta expõe (sem a categoria Performance). O CLS de 1,114
> registrado pelo Lighthouse vem dessa página sem dados e **não** é citado como achado.
>
> **O broker MQTT local estava desligado** (`ws://localhost:8083` recusou a conexão). Todos os
> achados de MQTT vêm da leitura do código e não foram disparados.
>
> **O proxy reverso de produção é desconhecido.** O usuário confirmou que existe, mas não sabe se
> cacheia HTML nem se valida o `Host`. As severidades de S-01 e S-04 assumem o pior caso razoável.
>
> **O backend não foi auditado.** Onde a severidade depende do backend (CSRF no logout por GET, ACL
> do broker, rotação de refresh token), isso está dito no achado.

### 2.3 Protocolo das medições

| Item | Valor |
|---|---|
| Máquina | Intel i5-12600K (16 *threads*), 62 GB, Linux 7.2.7 (Arch), carga de fundo não controlada |
| Runtime | Node 26.10.0 local (o CI e o Docker usam 24.11.1); Chrome Headless 154 |
| Latência SSR | `curl` em `localhost`, 12 execuções por URL, 2 de aquecimento descartadas → n = 10, estado quente; mediana e máximo de 10 (≈ p95) |
| Memória SSR | RSS do processo (`ps -o rss`) após cada rodada de 3.000 URLs únicas, 8 conexões paralelas, 4 rodadas |
| Navegador | contexto isolado novo (frio), sem *throttling*, n = 1 — **indicativo** |

### 2.4 Métricas de referência

| Métrica | Limiar | Fonte |
|---|---|---|
| Vida do token × vida do cookie | cookie não deve sobreviver ao token | OWASP [F13] |
| Bundle inicial | 750 kB aviso / 1,5 MB erro | `angular.json:72-73` |
| Hosts aceitos pelo SSR | allowlist explícita | Angular — SSRF [F3] |
| Pinagem de *actions* | SHA completo | GitHub Docs [F14] |

---

## 3. Evidências medidas

### 3.1 O build está saudável e o bundle inicial está dentro do orçamento

Saída de `npx ng build --configuration production`:

| Medida | Valor | Origem |
|---|---|---|
| Inicial (bruto / transferência estimada) | 565,13 kB / 152,54 kB | saída do build |
| JS fora do inicial (108 arquivos `.js` no total) | 3,74 MB bruto · 1,11 MB gzip-9 | `stat` + `gzip -9c` sobre `dist/front/browser` |
| Maior chunk *lazy* | 1,15 MB (`index`, ECharts) | saída do build |
| `pdf-page-component` (pdfjs) | 495,6 kB | saída do build |
| `apiURLServer` no bundle do navegador | `"http://host.docker.internal:3000/api"` em `chunk-56YEPBKB.js` | `grep -o 'apiURLServer:"[^"]*"' dist/front/browser/*.js` |

O inicial de 565 kB está abaixo do aviso de 750 kB. **mqtt, pdfjs e ECharts estão fora dele.** O
problema de bytes está no que vem **depois** da carga inicial (3.4 e P-01).

### 3.2 A suíte de testes falha no HEAD

```text
Executed 388 of 388 (6 FAILED) (14.222 secs / 12.681 secs)
TypeError: Cannot read properties of undefined (reading 'subscribe')
    at ReadingProgressSyncService.setupMqttListeners (reading-progress-sync.service.ts:128:65)
```

`gh run list --branch developer -L 6` mostra os três últimos *pushes* em `failure`:
2026-08-23, 2026-09-01 e 2026-09-15. As duas falhas anteriores foram de infraestrutura
(*buildx* no runner self-hosted); a de 2026-09-15 é esta. A saída tem ainda 8 ocorrências de
`NG0205` (injector destruído com HTTP pendente) e 110 linhas de `console.log`.

### 3.3 O servidor SSR não comprime, não envia cabeçalhos de segurança e devolve 200 para o que não existe

Contra `node dist/front/server/server.mjs` na porta 4100:

| Teste | Resultado |
|---|---|
| `curl -D - /` | `X-Powered-By: Express`; **nenhum** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options` |
| `Accept-Encoding: gzip, br` em `/` e num chunk JS | sem `Content-Encoding`; `Content-Length` = tamanho bruto (112.170 B e 203.599 B) |
| `Cache-Control` de `ngsw-worker.js`, `custom-sw.js`, `ngsw.json` | `public, max-age=31536000` nos três |
| `/assets/nao-existe.png` | **200**, 36.000 B de HTML com `<app-root>` |
| `/rota-que-nao-existe` | **200**, 36.000 B; o log registra `NG04002` com *stack trace* |
| `/robots.txt` | **200** `text/html` (o Lighthouse reprova `robots-txt` com 55 linhas inválidas) |
| `Host: evil.example` | 200; o HTML **não** reflete o host (0 ocorrências) |

Latência (protocolo 2.3):

| URL | Mediana | Máx. de 10 |
|---|---|---|
| `/` (home, SSR) | 23,2 ms | 36,5 ms |
| `/books` (SSR) | 22,0 ms | 34,3 ms |
| `/assets/nao-existe.png` (SSR de erro) | 6,8 ms | 10,1 ms |
| `/favicon.ico` (estático) | 7,5 ms | 16,2 ms |

**Recurso limitante:** CPU de um único processo Node; a API local responde em `localhost`. Com o
backend remoto, a latência do SSR passa a ser dominada pela rede até a API.

### 3.4 O service worker baixa o aplicativo inteiro na instalação

`ngsw-config.json:12-35` declara `installMode: "prefetch"` para `/*.js` e para todos os assets. A
conta, feita sobre o `ngsw.json` gerado:

| Grupo | Arquivos | Bruto | gzip-9 |
|---|---|---|---|
| `app` (todo JS e CSS, incluindo ECharts e pdfjs) | 108 | 3,72 MB | 1,10 MB |
| `assets` (fontes, bandeiras, ícones) | 134 | 1,58 MB | 1,47 MB |

Como o servidor não comprime (3.3), o custo real sem um proxy que comprima é de ~**5,3 MB** por
instalação. No navegador, num contexto frio e anônimo, 40 s na home deixaram:

- 77 scripts e 1,41 MB transferidos;
- 245 entradas no Cache Storage;
- 5,8 MB em `navigator.storage.estimate().usage`.

São n = 1, indicativos.

### 3.5 Verificação negativa: o SSR não vaza dados do usuário — porque nunca está logado

Com a sessão do usuário, fiz `fetch` da mesma origem em `/library`, `/user`, `/books` e `/home` no
`:4100`, com o cookie `accessToken` enviado (`cookieSent: true`). Em todas as rotas:

- o HTML contém o link de login;
- o `<script id="ng-state">` só carrega `GET /api/tags` e `GET /api/sensitive-content`, ambos
  públicos;
- não aparece nenhum e-mail nem `users/me`.

> **Não há vazamento de dados do usuário pelo `TransferState` hoje.** A hipótese do GHSA-q6f4 [F2]
> está refutada **no estado atual**. Ela volta a valer no instante em que C-10 for corrigido sem
> antes corrigir S-01 (ver seção 9).

### 3.6 Memória do SSR: sem vazamento observável

| Rodada (3.000 URLs únicas cada) | RSS |
|---|---|
| antes | 187.892 kB |
| 1 | 353.224 kB |
| 2 | 339.008 kB |
| 3 | 337.896 kB |
| 4 | 354.276 kB |

A hipótese de vazamento pelo `pageIsSSG = new Map()` do `CommonEngine`
(`node_modules/@angular/ssr/fesm2022/node.mjs:84,129`) foi testada. O RSS estabiliza em
~340–355 MB depois da primeira rodada.

> **Não há vazamento de memória induzível nessa escala** — a hipótese está refutada e é registrada
> aqui para não voltar a ser levantada.

O efeito colateral real foi o log: 6,17 MB e 30.052 linhas de `NG04002` para ~15 mil requisições
(~410 B por requisição a URL inexistente).

### 3.7 Cookies e token no navegador logado

`cookieStore.getAll()` na sessão do usuário:

| Cookie | Legível por JS | `secure` | `sameSite` | Expira |
|---|---|---|---|---|
| `accessToken` | **sim** | `false` | `lax` | +7 dias |
| `csrfToken` | sim | `false` | `lax` | +7 dias |
| `theme` | sim | `false` | `lax` | +7 dias |

O payload do JWT tem `exp − iat` = **15 min**. O cookie que o carrega vive 7 dias.

### 3.8 Lint e código morto

- `npx biome check .`: 1 *warning* (`noUnusedImports` em `mqtt.service.spec.ts:9`), e o comando
  termina com sucesso.
- `npx knip`:
  - 4 arquivos sem uso: `book-admin.service.ts`, `notification-example.component.ts`,
    `toast-notification.service.ts`, `autocomplete-input.component.ts`;
  - 2 dependências de produção sem uso: `@angular/platform-browser-dynamic` e
    `ngx-cookie-service-ssr`;
  - 21 tipos exportados sem uso, entre eles os eventos de socket.io que ficaram da migração para MQTT.

---

## 4. Achados de segurança

### S-01 · Dependências com advisories e lockfile parado em 21.0.1 — **Crítica**

`package-lock.json` fixa `@angular/*` em 21.0.1. `npm audit --omit=dev` (JSON bruto em
`scratchpad/npm-audit-prod.json`):

```text
{"info":0,"low":0,"moderate":11,"high":14,"critical":1,"total":26}
@angular/ssr critical  GHSA-x288-3778-4hhx  SSRF and Header Injection via request handling pipeline
@angular/common high   GHSA-q6f4-qqrg-jv6x  Information Leak via Default Caching of Credentialed Requests
@angular/platform-server high  (10 advisories: SSRF, XSS em raw-content, DoS)
@angular/core, @angular/compiler high  (sanitization bypass / XSS: SVG, MathML, i18n, host bindings)
@angular/service-worker high  GHSA-qxh6-94w6-9r5p  Sensitive Header Leakage on Cross-Origin Redirects
express high (path-to-regexp ReDoS, body-parser, qs) · echarts moderate (<6.1.0 XSS) · dompurify moderate
```

**Mecanismo.** O GHSA-x288 [F1] descreve o SSR confiando em `Host`/`X-Forwarded-Host`/`X-Forwarded-Port`
sem validação, o que permite redefinir a base de URLs relativas. A mitigação documentada,
`allowedHosts` [F3], **não existe** na versão instalada:

```bash
grep -rc "allowedHosts" node_modules/@angular/ssr/fesm2022/ node_modules/@angular/ssr/types/
# → 0 ocorrências
```

Os advisories de sanitização do `@angular/core`/`compiler` enfraquecem justamente a defesa que
S-02 já desliga. O Express 4.21.2 está fora da política de suporte do projeto ("only the latest
version of any given major release line is supported" [F7]); a última 4.x é 4.22.3.

O agravante é processual. `npm outdated` mostra `Wanted 21.2.25` para todo o `@angular/*`: o
*range* `^21.0.1` do `package.json` **já aceita** as versões corrigidas. Basta regenerar o
lockfile; nenhuma migração de *major* é necessária.

| Alcance | Impacto |
|---|---|
| Servidor SSR atrás de proxy que repassa `Host` | Alto — SSRF/open redirect conforme [F1] |
| Todos os navegadores | Alto — sanitizador com bypass conhecido |

**Reprodução:** `npm audit --omit=dev` na raiz; `npm ls @angular/ssr` → `21.0.1`.

**Correção:**
1. `npm update '@angular/*' @angular-devkit/build-angular @angular/cli express echarts ngx-markdown`
   dentro dos *ranges* atuais, e commitar o lockfile.
2. Configurar `security.allowedHosts` no `angular.json` ou `NG_ALLOWED_HOSTS` [F3].
3. Ligar o Dependabot/Renovate, que hoje não existe:
   `ls .github/dependabot.yml renovate.json` → ambos ausentes.
**Critério de aceite:** `npm audit --omit=dev --audit-level=high` sai com código 0, e esse comando
passa a ser um passo do CI.

---

### S-02 · `text-reader`: XSS armazenado via `bypassSecurityTrustHtml` — **Alta**

`text-reader.component.ts:124-128` + `text-reader.component.html:16`

```ts
private updateSafeContent() {
	if (this.format() === 'html' && this.content()) {
		this.safeContent.set(
			this.sanitizer.bypassSecurityTrustHtml(this.content()),
```

```html
<div class="html-content" [innerHTML]="safeContent()"></div>
```

**Mecanismo.** `content()` é o corpo do capítulo vindo da API. Num agregador, esse corpo é HTML
**raspado de sites de terceiros**. `bypassSecurityTrustHtml` desliga o sanitizador do Angular, que
removeria `<script>`, `onerror=` e `javascript:`. Qualquer fonte comprometida, ou qualquer falha de
sanitização no *scraper*, executa script na origem do Gatuno. Com S-03, esse script lê o
`accessToken` diretamente.

Para comparar, o caminho Markdown está correto: o `ngx-markdown` sanitiza por padrão, e o app não
sobrescreve isso.

```bash
grep -rn "SANITIZE\|SecurityContext.NONE" src/app
# → 0 resultados
```

| Alcance | Impacto |
|---|---|
| Quem abre um capítulo `contentFormat: 'html'` | Alto — execução de script com sessão ativa |

**Reprodução:** pela leitura do código, não disparado. Cadastrar um capítulo HTML com
`<img src=x onerror="alert(document.cookie)">` e abri-lo no leitor de texto: o `alert` mostra o
`accessToken`.

**Correção:** remover o `bypass` e atribuir `content()` direto a `[innerHTML]`. O sanitizador
embutido mantém a formatação e remove o ativo. Se o leitor precisar de tags que o sanitizador
descarta, sanitizar com DOMPurify, já presente na árvore via `mermaid`, mas declarado explicitamente
e na versão corrigida (S-01).
**Critério de aceite:** um teste do `text-reader` com `content = '<img src=x onerror="window.__xss=1">'`
afirma que, após `detectChanges`, `window.__xss` é `undefined` e o `<img>` renderizado não tem o
atributo `onerror`.

---

### S-03 · Access token em cookie criado por JS, `secure:false`, 7 dias, sem CSP — **Alta**

`cookie.service.ts:10-14` + `user-token.service.ts:148`

```ts
this.cookieConfig = {
	path: '/',
	secure: false,
	expires: new Date(new Date().setDate(new Date().getDate() + 7)),
};
```

```ts
setTokens(accessToken: string, csrfToken?: string) {
	this.cookieService.set(this.ACCESSKEY, accessToken, false);
```

**Mecanismo.**
- **Legível por JS.** Um cookie escrito por `document.cookie` nunca pode ser `HttpOnly`, então
  qualquer XSS lê o JWT. A OWASP trata exatamente esse caso: "A single Cross Site Scripting can be
  used to steal all the data" [F13].
- **Trafega em HTTP.** Com `secure:false`, o cookie também passa por HTTP sem TLS.
- **Sobrevive ao token.** O cookie dura 7 dias para um JWT de 15 minutos (3.7), então um token
  expirado fica em disco uma semana.
- **Sem CSP.** Não há `Content-Security-Policy` (3.3), a segunda linha de defesa contra S-02.

O refresh token está bem tratado: `user-token.service.ts:215-217` devolve `null`, e o refresh usa
cookie `withCredentials`. É esse o modelo a estender ao access token.

| Alcance | Impacto |
|---|---|
| Todo usuário logado | Alto, condicionado a um XSS (S-02 é um) |

**Reprodução:** logado, executar `document.cookie` no console; `accessToken=eyJ…` aparece. Em
Application → Cookies, a coluna HttpOnly está vazia.

**Correção:**
1. Fazer o backend emitir o access token como cookie `HttpOnly; Secure; SameSite=Lax`, como já
   faz com o refresh.
2. No front, deixar de ler o token: o interceptor para de montar `Authorization`, e o
   `jwtDecode` passa a ler um endpoint `/users/me`, que já existe.
3. Enquanto isso não for possível, o mínimo:
   - `secure: location.protocol === 'https:'`;
   - `expires` igual ao `exp` do JWT;
   - CSP com nonce via `autoCsp` [F3].
**Critério de aceite:** logado em HTTPS, `document.cookie.includes('accessToken')` é `false`, e
`curl -I` na home devolve `Content-Security-Policy` sem `unsafe-inline` em `script-src`.

---

### S-04 · `server.ts`: Host confiado, nenhum cabeçalho de segurança, engine sem allowlist — **Alta**

`server.ts:13-15,47-58`

```ts
const app = express();
const commonEngine = new CommonEngine();
app.use(cookieParser());
// …
const host = headers.host || 'localhost:4000';
const requestUrl = `${protocol}://${host}${originalUrl}`;
```

**Mecanismo.** A URL de renderização é montada com o `Host` do cliente. O `CommonEngine` está
*deprecated* desde a v22 [F5] e, na 21.0.1, não valida o host (S-01). Não há:
- `helmet`;
- `app.disable('x-powered-by')`;
- `trust proxy` (atrás do proxy, `req.protocol` é sempre `http`);
- compressão;
- *timeouts*.

O teste de 3.3 mostra que o host forjado **não é refletido** no HTML hoje. O vetor do
advisory [F1] são requisições `HttpClient` relativas no servidor, e o app não as faz:

```bash
grep -rnE "assets/[^'\"]*\.json|'/data/" src/app --include='*.ts' | grep -v spec
# → só as duas linhas que definem a exclusão; nenhuma requisição
```

Isso torna o risco **latente, não explorado**, e explica a severidade Alta e não Crítica.

**Reprodução:** `curl -sI http://localhost:4100/` — sem nenhum dos cabeçalhos da tabela 3.3, com
`X-Powered-By: Express`.

**Correção:** migrar para `AngularNodeAppEngine` com `allowedHosts`, seguindo o exemplo oficial de
`server.ts` [F4], o que também resolve C-01. Acrescentar `helmet` (CSP com nonce, HSTS,
`frame-ancestors 'none'`), `compression()` e `app.set('trust proxy', 1)`.
**Critério de aceite:** `curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example' http://localhost:4000/`
devolve `400`, e `curl -sI` lista CSP, HSTS e `X-Content-Type-Options` sem `X-Powered-By`.

---

### S-05 · `window.open(url, '_blank')` sem `noopener`, com URLs raspadas — **Média**

`chapters.component.ts:942` + `info-book.component.ts:1186,1635,2169`

```ts
window.open(current.originalUrl, '_blank');
```

**Mecanismo.** Ao contrário de `<a target="_blank">`, `window.open` **não** implica `noopener`: a
página aberta recebe `window.opener` [F9] e pode redirecionar a aba do Gatuno para uma página de
*phishing* (*reverse tabnabbing*). `originalUrl` e `source` vêm do *scraper*. O esquema também não é
validado, então um `javascript:` armazenado executaria.

**Reprodução:** pela leitura do código. Num capítulo cujo `originalUrl` aponta para uma página com
`opener.location = 'https://exemplo-phishing'`, clicar em "abrir original" redireciona a aba do
Gatuno.

**Correção:** um utilitário `openExternal(url)` que só aceita `https?:` (via `new URL`) e chama
`window.open(url, '_blank', 'noopener,noreferrer')`, usado nos 4 locais.
**Critério de aceite:** `grep -rn "window.open(" src/app --include='*.ts' | grep -v spec | grep -v noopener`
devolve só as duas chamadas internas com `window.location.origin` (`item-book.component.ts:205`,
`info-book.component.ts:1587`).

---

### S-06 · JWT persistido no IndexedDB pela fila de sync e mantido após o logout — **Média**

`reading-progress-sync.service.ts:216-222` + `unified-reading-progress.service.ts:321-327` +
`custom-sw.js:85-91`

```ts
await this.localProgressService.enqueueSync({
	...progressData,
	timestamp: progressData.timestamp ?? Date.now(),
	accessToken: token,
});
```

**Mecanismo.** Quando o envio HTTP falha (offline), o JWT vai para o disco, dentro da `sync_queue`.
`onUserLogout` cancela o timer e desconecta, mas **não** esvazia a fila. Num dispositivo
compartilhado, o service worker sincroniza mais tarde o progresso do usuário anterior com o token
dele. Ver também C-07: com um JWT de 15 min, esse token raramente ainda é válido, então o caso comum
é o item ficar preso para sempre.

**Reprodução:** pela leitura do código. Offline, avançar uma página; fazer logout; em Application →
IndexedDB → `gatuno_db` → `sync_queue`, o item continua lá com `accessToken`.

**Correção:** não persistir o token. O SW pede o token atual à página via `postMessage`, ou, depois
de S-03, simplesmente usa `credentials: 'include'`. No logout, limpar a `sync_queue`.
**Critério de aceite:** um teste de `onUserLogout` afirma que `getSyncQueue()` devolve `[]`, e
`grep -n "accessToken" src/custom-sw.js` devolve 0 linhas.

---

### S-07 · Logout por `GET`, e os tokens só são apagados no sucesso — **Média**

`auth.service.ts:74-88` + `user-menu.organism.ts:120`

```ts
return this.http
	.get<void>('/auth/logout', { withCredentials: true, headers: … })
	.pipe(tap(() => { this.userTokenService.removeTokens(); … }));
```

```ts
this.authService.logout().subscribe();
```

**Mecanismo.**
- **Logout que falha mantém a sessão.** A limpeza local está dentro do `tap` de sucesso.
  Offline, ou se a API devolver 5xx, o usuário clica "Sair" e continua logado, sem nenhum aviso,
  porque o `subscribe()` não trata erro.
- **Logout forjável.** Um `GET` que muda estado pode ser disparado por um `<img src>` de terceiro.
  Se o backend autentica pelo cookie (S-03 o torna disponível), qualquer site desloga o usuário.
  A gravidade depende do backend.

**Reprodução:** logado, ativar Offline no DevTools e clicar "Sair": o menu fecha e o avatar
continua.

**Correção:** limpar o estado local **antes** da chamada, com `finalize` ou limpeza imediata e
chamada *fire-and-forget*. Migrar o endpoint para `POST` com CSRF, como já fazem as mutações em
`http-client-request.interceptor.ts:78-84`.
**Critério de aceite:** um teste de `AuthService.logout` com `HttpTestingController` respondendo
erro 500 afirma que `userTokenService.accessToken` é `null` ao final.

---

### S-08 · CI: workflows `@main` com `secrets: inherit`, actions sem SHA, sem `permissions` — **Média**

`.github/workflows/ci.yml:25,34,49,60,73,77`

```yaml
uses: gatuno-manga/workflows/.github/workflows/registry.yml@main
# …
secrets: inherit
```

**Mecanismo.**
- **Tudo pinado por *ref* mutável.** Os dois workflows reutilizáveis estão pinados em `@main`, e
  `fkirc/skip-duplicate-actions@v5`, `actions/checkout@v7` e `actions/setup-node@v7` estão pinados
  por *tag*. Para a GitHub, pinar pelo SHA completo é "the only way to use an action as an
  immutable release" [F14].
- **Segredos sem filtro.** `secrets: inherit` entrega todos os segredos a um workflow que muda sem
  revisão neste repositório.
- **Permissões amplas.** Não há bloco `permissions:` global, e a recomendação é token
  somente-leitura por padrão [F14].
- **Runner persistente.** O build roda em `self-hosted`, que a documentação desaconselha por não
  ser efêmero [F14].

**Reprodução:** `grep -nE "uses: .*@(main|v[0-9]+)$" .github/workflows/ci.yml` → 5 linhas.

**Correção:**
1. `permissions: { contents: read }` no topo.
2. Pinar as 3 *actions* e os 2 workflows por SHA, com comentário da versão.
3. Trocar `secrets: inherit` pela lista explícita.
**Critério de aceite:** `grep -cE "uses: [^ ]+@[0-9a-f]{40}" .github/workflows/ci.yml` devolve 5,
`grep -c "secrets: inherit"` devolve 0, e `grep -n "^permissions:"` encontra 1 linha.

---

### S-09 · MQTT: payload inteiro no console de produção, `ws://` por padrão, tópicos sem validação — **Média**

`mqtt.service.ts:428-432` + `generate-env.ts:41` + `mqtt.service.ts:652-653`

```ts
private handleMessage(topic: string, messageStr: string): void {
	console.log(
		`[MQTT_DEBUG] 📥 MENSAGEM RECEBIDA | Tópico: [${topic}] | Conteúdo:`,
		messageStr,
	);
```

**Mecanismo.**
- **Payload no console.** Todas as mensagens, inclusive notificações pessoais, vão para o console
  em produção, sem passar pelo logger, que tem flag de ambiente.
- **Sem TLS por padrão.** O padrão do broker é `ws://localhost:8083/mqtt`, e só vira `wss` se a
  página estiver em HTTPS (`mqtt.service.ts:303-305`).
- **Tópico interpolado sem validação.** `books/events/book/${bookId}` aceita `#` e `+`. Isso não é
  explorável pelo front sozinho (a ACL do broker manda), mas não há validação do id antes da
  inscrição.
- **Fora do escopo do achado:** no login medido (3.7), o console recebeu 114 linhas
  `✅ Progresso salvo para usuário <uuid>` de `reading-progress.service.ts`, que também expõem
  identificadores.

**Reprodução:** pela leitura do código; o broker local estava desligado (2.2).

**Correção:** substituir os `console.log` por `logWebSocketEvent` do logger existente
(`websocket-logger.utils.ts`) e validar `bookId`/`chapterId` contra `^[0-9a-f-]{36}$` antes de
assinar.
**Critério de aceite:** `grep -rn "console.log" src/app/core/services/mqtt.service.ts` devolve 0
linhas, e um teste afirma que `watchBook('#')` lança erro sem chamar `client.subscribe`.

---

### S-10 · `/user/**` sem guard; os guards de login nunca são usados — **Média**

`app.routes.ts:101-109` + `auth.guard.ts:6`

```ts
{
	path: 'user',
	loadComponent: () => import('./pages/user/outlet/outlet.component')…,
	data: { ssr: { renderMode: RenderMode.Client } },
	loadChildren: () => import('./pages/user/user.routes')…,
},
```

```bash
grep -rn "isLoggedGuard\|isLoggedMatchGuard\|isNotLoggedGuard" src/app --include='*.ts' | grep -v "spec\|auth.guard.ts"
# → 0 resultados
```

**Mecanismo.** As telas de MFA, passkeys e perfil carregam e renderizam para anônimos. O backend
deve barrar os dados, então isso não é vazamento, mas é falha de defesa em profundidade e uma UX de
telas quebradas. Os guards existem, com spec, e estão órfãos.

**Reprodução:** em contexto anônimo, abrir `/user`: a tela renderiza (o SSR de `/user` medido em
3.5 devolve 225 kB de HTML).

**Correção:** `canMatch: [isLoggedMatchGuard]` em `user` e `library`.
**Critério de aceite:** um teste de rota com `RouterTestingHarness` sem token afirma que navegar
para `/user` termina em `/auth/login`.

---

### S-11 · Topologia interna no bundle do navegador — **Baixa**

`generate-env.ts:38-40` + `index.html:52-53`

```ts
apiURLServer: '${process.env.API_URL_SERVER || process.env.API_URL || 'http://localhost:3000'}/api',
```

```html
<link rel="preconnect" href="http://localhost:3000" />
<link rel="preconnect" href="https://api-gatuno.canto.internal" />
```

**Mecanismo.** A URL que só o servidor usa vai para o `environment`, que o cliente importa: medido
em 3.1 como `host.docker.internal:3000`. O `index.html` versionado expõe o nome DNS interno e abre
uma conexão inútil a `localhost:3000` em todo visitante.

**Reprodução:** `grep -o 'apiURLServer:"[^"]*"' dist/front/browser/*.js`.

**Correção:** ler `API_URL_SERVER` só em runtime no servidor, como `api-url.utils.ts:89-101` já
faz, removê-lo do `environment`, e remover os dois `preconnect`.
**Critério de aceite:** `grep -rl "apiURLServer\|canto.internal\|host.docker.internal" dist/front/browser`
não devolve nada.

---

### S-12 · `NODE_ENV=development` como padrão do compose e dev server com `disableHostCheck` — **Baixa**

`docker-compose.yml:7` + `angular.json:108-110`

```yaml
- NODE_ENV=${NODE_ENV:-development}
```

**Mecanismo.**
- **Stack trace exposto.** Combinado com o `prod`, o compose base sobrescreve o
  `ENV NODE_ENV=production` do `Dockerfile.prod:35`. O handler padrão do Express, alcançado por
  `server.ts:68`, passa a devolver *stack traces*.
- **Dev server aberto à rede.** `"host": "0.0.0.0", "disableHostCheck": true` abre o dev server à
  LAN e a *DNS rebinding*.

**Reprodução:**
`docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep NODE_ENV`
→ `development`.

**Correção:** `NODE_ENV=${NODE_ENV:-production}` no compose base e remover `disableHostCheck`.
**Critério de aceite:** o comando da reprodução devolve `production`.

---

## 5. Correção e confiabilidade

### C-01 · `renderMode` e `cache` das rotas são configuração morta — **Alta**

`app.routes.ts:10-28,73,90,106,116` + `app.config.server.ts:2,5`

```ts
const SERVER_RENDER_CONFIG = (key: string) => ({
	ssr: { renderMode: RenderMode.Server, cache: { key, ttl: 60 * 60 } },
});
// …
data: { ssr: { renderMode: RenderMode.Client } },
```

```bash
grep -rn "renderMode\|data\.ssr\|withRoutes\|ServerRoute" src --include='*.ts' | grep -v app.routes.ts
# → 0 resultados
ls src/app/app.routes.server.ts
# → No such file or directory
```

**Mecanismo.** O Angular lê modos de renderização de um `ServerRoute[]` passado a `withRoutes`, em
`app.routes.server.ts` [F4], e **não** de `data` nas rotas do cliente. Como `server.ts` usa o
`CommonEngine` legado e `provideServerRendering` vem de `@angular/platform-server`, nada disso tem
efeito:
- o leitor (`books/:id/:chapter`, com o comentário "Client-side only"), `/user`, `/library` e
  `/dashboard` passam por SSR;
- o "cache de 1 h/24 h" **não existe**;
- o build relata `Prerendered 0 static routes`.

O cache inexistente é o que mais engana quem lê o código: dá a impressão de que o SSR está
protegido contra carga.

**Reprodução:** `curl -s localhost:4100/user | wc -c` → 225.759 bytes de HTML renderizado no
servidor, para uma rota marcada `RenderMode.Client`.

**Correção:**
1. Criar `app.routes.server.ts` com os modos hoje escritos em `data`.
2. Usar `provideServerRendering(withRoutes(serverRoutes))` de `@angular/ssr`, que existe na 21.0.1:
   o pacote exporta `withRoutes` e `RenderMode`.
3. Migrar o servidor para `AngularNodeAppEngine` [F4], unidade comum com S-04.
4. Remover `data.ssr`. O cache por TTL não é uma feature do Angular: precisa de cache HTTP no proxy
   (`Cache-Control`), ou deve ser removido.
**Critério de aceite:** `curl -s localhost:4000/books/<id>/<cap> | grep -c '<app-chapters'` devolve
0 (*shell* CSR), e o build relata `Prerendered N static routes` com N ≥ 1 para as rotas
`Prerender`.

---

### C-02 · `getProgress` devolve o progresso local antigo quando o servidor está à frente — **Alta**

`reading-progress-sync.service.ts:248-264` + `reading-progress.service.ts:153-160`

```ts
await this.localProgressService.saveProgress(remote.chapterId, …, remote.pageIndex, …);
return this.localProgressService.getProgress(chapterId);
```

```ts
this.saveSubject.next({ chapterId, bookId, pageIndex, userId: targetUserId, updatedAt });
return Promise.resolve();
```

**Mecanismo.** `saveProgress` só empurra para um `Subject` com `debounceTime(1000)`
(`reading-progress.service.ts:52-55`) e resolve na hora. O `await` não espera nada, e a leitura
seguinte devolve o valor **anterior** do IndexedDB. Esse caminho é justamente o cenário que a
sincronização existe para resolver: o usuário leu no celular, abre o desktop, e o leitor abre na
página antiga, ou no início se não havia progresso local.

| Alcance | Impacto |
|---|---|
| Leitura em dois dispositivos | Alto — retomada errada a cada troca de dispositivo |

**Reprodução:** pela leitura do código. No dispositivo A, ler até a página 30. No dispositivo B,
sem progresso local, abrir o capítulo: o leitor abre na página 0, e só no próximo acesso abre
na 30.

**Correção:** no ramo remoto, devolver o objeto remoto já normalizado, sem reler, e gravar em
segundo plano. Ou expor um `saveProgressNow()` que grave sem debounce.
**Critério de aceite:** um teste de `getProgress` com local `pageIndex: 3` e remoto
`pageIndex: 30` afirma que o valor devolvido tem `pageIndex === 30`. O spec atual, quebrado por Q-01,
só cobre o caso local.

---

### C-03 · MQTT congela o JWT como senha e desiste no primeiro reconnect após a expiração — **Alta**

`mqtt.service.ts:269-281,397-405,222-228,574`

```ts
username: userId || 'gatuno-user',
password: token,
keepalive: 5,
reconnectPeriod: 5000,
```

```ts
if (this.isAuthError(err)) { … this.disconnect(); }
// isAuthError:
message.includes('connection refused')
```

**Mecanismo.**
- **Senha congelada.** O mqtt.js reaproveita `options` em cada reconexão. O JWT dura 15 min (3.7),
  então qualquer queda de rede depois disso reconecta com token vencido → `Not authorized` →
  `disconnect()`.
- **Watchers perdidos.** O `disconnect()` limpa `subscribedTopics` (`:574`), e os *watchers* ativos
  de livro e capítulo perdem seus tópicos em silêncio.
- **`isAuthError` largo demais.** Também casa com "Connection refused: Server unavailable", um erro
  **transitório**, e com isso também mata o reconnect.

O mqtt.js documenta o gancho para isso: `transformWsUrl` atualiza `client.options.password` antes
de cada reconexão por WebSocket [F8]. Está disponível na 5.15.1 instalada
(`node_modules/mqtt/build/lib/client.d.ts:65`).

**Reprodução:** pela leitura do código; o broker local estava desligado. Conectar, esperar 16 min,
derrubar a rede por 10 s: o estado vai para `DISCONNECTED` e não volta.

**Correção:**
1. `transformWsUrl: (url, opts, client) => { client.options.password = this.userTokenService.accessToken; return url; }`.
2. Restringir `isAuthError` aos códigos CONNACK 4/5.
3. Reconectar ao receber `TOKEN_UPDATE` do `CrossTabSyncService`.
**Critério de aceite:** um teste com `createMqttClient` *mockado* (o *seam* já existe) troca o token,
emite `reconnect` e afirma que `client.options.password` é o token novo e que `disconnect` não foi
chamado.

---

### C-04 · Refresh: TOCTOU entre abas, duas políticas de logout e um signal que não expira — **Alta**

`user-token.service.ts:251-266,276-278,283-290,316-322,74-78`

```ts
const lock = localStorage.getItem(this.REFRESH_LOCK_KEY);
// …
localStorage.setItem(this.REFRESH_LOCK_KEY, now.toString());
// …
.subscribe({ error: () => this.removeTokens(true) });
```

**Mecanismo.** Quatro defeitos independentes no mesmo fluxo:
1. **Trava não atômica.** O lock é `get` seguido de `set`, então duas abas no mesmo *tick* passam
   juntas. O ramo `else` (`:283-290`) nem usa o lock. Se o backend rotaciona o refresh token, a
   segunda aba toma 401 e transmite `TOKEN_REMOVE`, deslogando todas.
2. **Logout em qualquer erro.** O auto-refresh chama `removeTokens(true)` em **qualquer** erro,
   inclusive rede (status 0) e 5xx. O interceptor só desloga em 401/403
   (`http-client-response.interceptor.ts:66-79`). Uma queda de Wi-Fi no minuto do refresh desloga o
   usuário.
3. **CSRF ausente desloga.** Sem CSRF, `refreshTokens()` lança um `Error` genérico (`:316-322`),
   que o auto-refresh também converte em logout.
4. **Signal que não expira.** `hasValidAccessTokenSignal` é um `computed` sobre `Date.now()`, que
   não é reativo. Depois do `exp`, continua `true` até o token mudar, e guards e `UserService`
   confiam nele.

**Reprodução:** logado, em Network → Offline, esperar o momento do refresh (~14 min): a sessão cai,
embora o refresh token seja válido.

**Correção:**
- Usar a Web Locks API (`navigator.locks.request('gatuno-refresh', …)`), que é atômica entre abas.
- Unificar a política de logout no critério do interceptor (só 401/403).
- Dar ao signal um *tick* (`timer` até o `exp`) ou trocar o `computed` por um signal atualizado no
  agendamento.
**Critério de aceite:** dois testes:
1. o auto-refresh com erro `status: 0` não chama `removeTokens`;
2. com `jasmine.clock()` avançado além do `exp`, `hasValidAccessTokenSignal()` devolve `false`.

---

### C-05 · Progresso perdido: `lastSyncAt` ambíguo, debounce de slot único, nada no `pagehide` — **Alta**

`reading-progress-sync.service.ts:199-204` + `unified-reading-progress.service.ts:166-181,272-279`

```ts
this.updateSyncStatus({ pendingChanges: this.pendingChanges.size, lastSyncAt: new Date() });
```

```ts
this.pendingSyncData = progressData;
if (this.syncTimeout) clearTimeout(this.syncTimeout);
this.syncTimeout = setTimeout(async () => { … }, this.SYNC_DEBOUNCE_MS);
```

```ts
const progressToSync = lastSyncAt
	? localProgress.filter((p) => new Date(p.updatedAt) > lastSyncAt)
	: localProgress;
```

**Mecanismo.** Três perdas independentes:
1. **`lastSyncAt` com dois significados.** Ele é atualizado quando **um** item sincroniza, mas é
   usado como marca d'água para o histórico **inteiro**. Itens locais mais antigos e ainda não
   enviados ficam abaixo da marca e nunca sobem.
2. **Slot único no debounce.** O debounce de 10 s guarda **um** `pendingSyncData`. Trocar de
   capítulo em menos de 10 s descarta o progresso do anterior.
3. **Nada salva ao sair.** Não há *flush* em `visibilitychange`/`pagehide`, que a MDN indica como os
   eventos confiáveis para salvar estado [F12]. Fechar a aba perde até 10 s de progresso remoto e
   1 s de local.

```bash
grep -rn "pagehide\|beforeunload" src/app --include='*.ts' | grep -v spec
# → 0 resultados
```

**Reprodução:** pela leitura do código. Ler o capítulo 1 até a página 20, abrir o capítulo 2 e
fechar a aba em menos de 10 s. Em outro dispositivo, o capítulo 1 aparece na página anterior.

**Correção:**
- Trocar `pendingSyncData` por um `Map<chapterId, dto>`.
- Fazer *flush* em `visibilitychange` (estado `hidden`) com `fetch(..., { keepalive: true })`.
- Sincronizar o histórico por flag `synced` por item, e não por marca d'água global.
**Critério de aceite:** um teste com `fakeAsync` chama `saveProgress` para dois capítulos com 2 s de
intervalo, avança 10 s e afirma **duas** chamadas `POST`; outro teste dispara `visibilitychange`
com `hidden` e afirma o envio imediato.

---

### C-06 · Ref-counting de tópicos MQTT quebrado por três vias — **Média**

`mqtt.service.ts:652-654,718-726,760-767,355-358`

```ts
this.subscribeTopic(chapterTopic);
this.subscribeTopic(bookTopic);
// … teardown:
this.unsubscribeTopic(chapterTopic);
// Não damos unsubscribe do bookTopic porque ele pode estar sendo usado por watchBook simultaneamente,
// idealmente haveria um ref count por tópico.
```

**Mecanismo.** O ref-count existe, mas:
1. **`watchChapter` nunca decrementa o tópico do livro.** O comentário pressupõe que não há
   ref-count. Cada capítulo aberto soma +1 permanente, e o broker continua mandando eventos de todos
   os livros já lidos na sessão.
2. **O incremento roda na criação do Observable, não no `subscribe`.** Um Observable assinado duas
   vezes decrementa duas vezes; um criado e nunca assinado vaza a referência.
3. **Tópicos dinâmicos inflam a cada reconnect.** Eles são reinscritos em todo `connect`
   (`:355-358`), e o contador cresce.

O commit `1437df3` ("fix: correct MQTT topic ref-counting") não tocou nenhum spec, e o spec do MQTT
não cobre isto:

```bash
grep -c "watchBook\|subscribeTopic\|unsubscribeTopic\|watchChapter" src/app/core/services/mqtt.service.spec.ts
# → 0
```

**Reprodução:** pela leitura do código. Abrir 5 capítulos de livros diferentes e voltar à home:
`subscribedTopics` ainda contém os 5 `books/events/book/*`.

**Correção:** mover `subscribeTopic` para dentro do *subscriber* do `new Observable`, decrementar
`bookTopic` no teardown, e reinscrever os tópicos dinâmicos sem incrementar.
**Critério de aceite:** um teste assina e cancela `watchChapter(c, b)` três vezes e afirma que o
contador de `books/events/book/b` volta a 0 e que `client.unsubscribe` foi chamado com ele.

---

### C-07 · Background Sync: token vencido, URL fixa, sem CSRF, sem nova tentativa — **Média**

`custom-sw.js:6,79-94` + `reading-progress-sync.service.ts:224-226`

```js
const API_BASE_URL = '/api/users/me/reading-progress';
// …
headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${item.accessToken}` },
```

**Mecanismo.**
- **Envio sempre falha.** O item é enfileirado justamente quando está offline, e quando a rede volta
  o JWT de 15 min já venceu. `sendProgress` devolve `false`, o item fica na fila, e o handler do
  `sync` termina **com sucesso**, então o navegador não reagenda.
- **URL errada.** `API_BASE_URL` é relativa à origem do front, e ignora `environment.apiURL`, que
  em produção é outro host.
- **Sem CSRF.** Falta o cabeçalho `x-csrf-token`.
- **Erros engolidos.** O `.catch(() => {})` esconde falhas de registro.

O resultado prático é uma fila que só cresce.

**Reprodução:** pela leitura do código. Offline, avançar páginas; esperar 16 min; voltar online; em
Application → IndexedDB, a `sync_queue` continua com os itens.

**Correção:** depois de S-03, `credentials: 'include'` com a URL da API vinda da página via
`postMessage`. Lançar erro no handler quando algum item falhar, para que o navegador reagende. Ou
abandonar o SW e fazer o *flush* pela página no evento `online`, que já existe em
`network-status.service.ts`.
**Critério de aceite:** com o servidor respondendo 500, o `event.waitUntil` rejeita; com 200, a fila
fica vazia. Testável extraindo `syncReadingProgress` para um módulo puro com `fetch` injetado.

---

### C-08 · IndexedDB: 4 bancos, sem migração por versão, sem `blocked`, sem quota — **Média**

`download.service.ts:47-55` + `reading-progress.service.ts:98-110` + `custom-sw.js:48-54`

```ts
this.dbPromise = openDB<GatunoOfflineDB>('GatunoOfflineDB', 1, {
	upgrade(db) {
		db.createObjectStore('books', { keyPath: 'id' });
```

**Mecanismo.**
- **Quatro bancos para um app.** `gatuno_db` v3 (API crua), `GatunoOfflineDB` v1, `GatunoSyncDB` v1
  (uma única chave) e `GatunoNotificationsDB` v1.
- **Upgrade que vai quebrar.** Os `upgrade` ignoram `oldVersion` [F11], então o primeiro bump de
  versão lança `ConstraintError` ao recriar as stores existentes.
- **Abertura sem saída.** Nenhum `blocked`/`blocking` [F11]. O SW abre `gatuno_db` sem versão e
  nunca fecha, o que bloqueia a futura v4 enquanto viver.
- **Downloads apagáveis.** Não há `navigator.storage.persist()`, e sem ele o armazenamento é
  *best-effort*: "may be cleared by the UA under storage pressure" [F10]. Para um app de leitura
  offline, isso significa downloads que somem.

```bash
grep -rn "QuotaExceeded\|storage.persist\|storage.estimate\|onblocked\|blocking(\|onversionchange" src
# → 0 resultados
```

**Reprodução:** pela leitura do código. Mudar `GatunoOfflineDB` para a versão 2 sem alterar o
`upgrade`, recarregar com dados v1: `ConstraintError` no console e `dbPromise` rejeitado.

**Correção:**
- `upgrade(db, oldVersion) { if (oldVersion < 1) {…} if (oldVersion < 2) {…} }`.
- `blocking() { db.close() }`.
- `navigator.storage.persist()` no primeiro download.
- A médio prazo, consolidar em um banco com versionamento único.
**Critério de aceite:** um teste com `fake-indexeddb` abre v1, popula, reabre v2 e afirma que os
dados v1 continuam acessíveis.

---

### C-09 · Download offline: capítulo incompleto salvo como "completo" e dois caminhos duplicados — **Média**

`download.service.ts:480-518` (caminho em uso) + `:183` (`syncBook`, sem chamador)

```ts
return { index, blob: null };
// …
.filter((r) => r.blob !== null)
// …
await db.put('chapters', offlineChapter);
this.updateProgress(chapter.id, { …, current: chapter.pages.length, status: 'completed' });
```

**Mecanismo.** Páginas que falham são descartadas. Desde que **uma** página tenha baixado, o
capítulo é gravado e anunciado como `completed` com páginas faltando. A leitura offline pula
páginas sem aviso.

O código `@deprecated Use syncBook instead` (`:408`) é o **único** em uso: `book.component.ts:1016`,
`info-book.component.ts:868` e `item-book.component.ts:338`. Já `syncBook` não tem chamador:

```bash
grep -rn "syncBook(" src/app | grep -v spec
# → só a definição, em download.service.ts:183
```

**Reprodução:** pela leitura do código. Baixar um capítulo com uma das URLs de página bloqueada no
DevTools (Network request blocking): o capítulo aparece como baixado e a página bloqueada não
existe offline.

**Correção:** gravar `missingPages`/`status: 'partial'` e oferecer "baixar de novo". Remover um dos
dois caminhos, e não manter a anotação `@deprecated` invertida.
**Critério de aceite:** um teste com `fetchImageBlob` falhando na página 2 de 5 afirma
`status === 'partial'` e `missingPages` contendo `[1]`.

---

### C-10 · SSR sempre anônimo; filtros de conteúdo e tema `true-dark` perdidos no primeiro render — **Média**

`cookie.service.ts:2` + `http-client-request.interceptor.ts:57,66-69` + `server.ts:61`

```ts
import { CookieService as AgCookieService } from 'ngx-cookie-service';
```

```ts
const theme = req.cookies?.theme === 'dark' ? 'dark' : 'light';
```

**Mecanismo.** O `ngx-cookie-service` só lê `document.cookie`, e no servidor devolve `''`. O
`ngx-cookie-service-ssr`, instalado justamente para isso, tem 0 imports (knip, 3.8). Consequências:
- o encaminhamento de cookie no SSR (`:66-69`) é código morto;
- o SSR renderiza como anônimo, **medido** em 3.5;
- o filtro de conteúdo sensível do usuário não vale no SSR, e o cliente re-renderiza com outro
  conteúdo;
- `true-dark` e os temas customizados viram `light` no primeiro *paint*.

**Reprodução:** com o tema `true-dark`, recarregar qualquer página SSR: o flash claro é visível
antes da hidratação.

**Correção:** decidir **explicitamente**:
- **(a) SSR anônimo por design.** Marcar como `RenderMode.Client` as rotas pessoais (C-01), remover
  o encaminhamento morto e o pacote `-ssr`, e só repassar o tema.
- **(b) SSR autenticado.** Usar o `-ssr`, mas **somente depois de S-01**: com SSR autenticado na
  21.0.1, o GHSA-q6f4 [F2] passa a vazar respostas com credenciais para o HTML.
- Nos dois casos, `server.ts:61` deve aceitar a lista de temas de `theme.service.ts`.
**Critério de aceite:** em (a), `grep -rn "ngx-cookie-service-ssr" package.json` devolve 0 linhas e
`curl -s -H 'Cookie: theme=true-dark' localhost:4000/ | grep -c 'data-theme="true-dark"'` devolve 1.

---

### C-11 · Sem `ErrorHandler` global, erros engolidos, e o logger oficial desligado em produção — **Média**

`websocket-logger.utils.ts:31-35` + `book.service.ts:82-94`

```ts
 * - **Produção**: Apenas WARN e ERROR
 */
const DEFAULT_CONFIG: LogConfig = {
	enabled: !environment.production,
```

```ts
catchError((err) => {
	if (!isPlatformBrowser(this.platformId)) {
		return of({ data: [], metadata: { total: 0, page: 1, lastPage: 0 } } …);
	}
	…
	return this.getOfflineBooks(options);
```

**Mecanismo.**
- **O logger contradiz a própria documentação.** A doc diz WARN/ERROR em produção, mas o código
  desliga tudo. Os erros de sincronização ficam invisíveis em produção, enquanto `console.log` de
  debug ficam ligados (S-09).
- **Erros convertidos em sucesso.** Qualquer erro, 403 e 500 incluídos, vira lista vazia no SSR ou
  modo offline no cliente. Um 500 no servidor é servido como "catálogo vazio" com status 200.
- **Nada captura o resto.** Não há handler global:

```bash
grep -rn "ErrorHandler\|provideBrowserGlobalErrorListeners" src --include='*.ts' | grep -v spec
# → 0 resultados
```

**Reprodução:** parar a API e fazer `curl -s localhost:4100/books`: 200 com a lista vazia renderizada.

**Correção:**
- `enabled: true` com `minLevel: environment.production ? WARN : DEBUG`.
- `provideBrowserGlobalErrorListeners()` mais um `ErrorHandler` que reporte.
- No SSR, propagar 5xx como status de resposta, e não como lista vazia.
**Critério de aceite:** com a API parada, `curl -s -o /dev/null -w '%{http_code}' localhost:4000/books`
devolve 503, e não 200.

---

### C-12 · `GET /users/me` disparado duas vezes no bootstrap — **Baixa**

`user.service.ts:20-30`

```ts
toObservable(this.userTokenService.hasValidAccessTokenSignal)
	.pipe(filter((authenticated) => authenticated === true), switchMap(() => this.fetchMe()))
	.subscribe();
if (this.userTokenService.hasValidAccessToken) {
	this.fetchMe().subscribe();
}
```

**Mecanismo.** `toObservable` já emite o valor inicial, e a chamada explícita duplica a requisição.

**Reprodução:** logado, recarregar com o filtro `users/me` no Network: duas requisições.

**Correção:** remover o bloco `if`.
**Critério de aceite:** um teste com `HttpTestingController` afirma `expectOne('/users/me')` no
bootstrap autenticado.

---

## 6. Performance

### P-01 · O service worker e o `PreloadAllModules` baixam o app inteiro para todo visitante — **Média**

`ngsw-config.json:12-35` + `app.config.ts:38`

```json
{ "name": "app", "installMode": "prefetch", "resources": { "files": [ …, "/*.css", "/*.js" ] } },
{ "name": "assets", "installMode": "prefetch", "updateMode": "prefetch", … }
```

**Mecanismo.** Dois mecanismos somados:
1. O `PreloadAllModules` baixa todas as rotas *lazy*: dashboard de admin, leitor de PDF e páginas
   de usuário.
2. O service worker faz *prefetch* de **todo** `.js` (108 arquivos, incluindo ECharts, que nenhuma
   rota pública usa) e de todos os 134 assets.

Medido em 3.4: 5,3 MB brutos por instalação sem compressão (P-02), e 5,8 MB de armazenamento no
navegador. O relatório irmão de `chapters` registrou o `PreloadAllModules` como **Baixa** por olhar
só a rota. Somado ao SW, o custo é de cada primeira visita.

| Alcance | Impacto |
|---|---|
| Celular em 4G | Alto — ~5 MB em segundo plano [modelado: 1,6 Mbps ⇒ ~26 s de banda ocupada] |
| Desktop | Baixo |

**Reprodução:** contexto anônimo novo, abrir a home e esperar 40 s;
`performance.getEntriesByType('resource')` soma 77 scripts, e `caches.keys()` mostra 245 entradas
(3.4).

**Correção:** `installMode: "lazy"` para o grupo de JS fora do inicial e para as bandeiras e fontes
não usadas. Trocar `PreloadAllModules` por uma estratégia que só pré-carregue rotas marcadas
(`data: { preload: true }`).
**Critério de aceite:** no mesmo protocolo de 3.4, `caches` com ≤ 40 entradas e
`navigator.storage.estimate().usage` < 1,5 MB após 40 s na home anônima.

---

### P-02 · Sem compressão, 404 como SSR 200 com *stack trace*, e `max-age` de 1 ano nos arquivos do SW — **Média**

`server.ts:32-38,47-69`

```ts
app.get('**', express.static(browserDistFolder, { maxAge: '1y', index: 'index.html' }));
```

**Mecanismo.**
- **Sem compressão.** Sem `compression()`, todo HTML e JS sai bruto (3.3): a home sai com 112.170 B; com
  `gzip -9` o mesmo HTML tem 17.264 B (medido sobre o arquivo salvo).
- **Nada vira 404.** Qualquer arquivo ou rota inexistente cai no SSR, devolve 200 com 36 kB de HTML,
  e grava ~410 B de *stack trace* no log (3.6). Isso inclui o `robots.txt`, que o Lighthouse reprova.
- **Cache de 1 ano em tudo.** O `maxAge: '1y'` vale para `ngsw.json`, `ngsw-worker.js` e
  `custom-sw.js`. O SW do Angular contorna isso no `ngsw.json` com *cache-bust*, mas o
  `custom-sw.js`, que é o script registrado, depende do limite de 24 h que o navegador aplica a
  scripts de SW.

O proxy de produção talvez comprima: 2.2.

**Reprodução:** os comandos `curl` de 3.3.

**Correção:**
- `compression()`.
- Uma rota `**` antes do SSR que devolve 404 para caminhos com extensão.
- `RenderMode` com `status: 404` para rotas desconhecidas (unidade com U-03).
- `Cache-Control: no-cache` para `ngsw*.json`, `*-sw.js` e `index*.html`.
- Um `robots.txt` real em `public/`.
**Critério de aceite:**
- `curl -s -o /dev/null -w '%{http_code}' localhost:4000/assets/nao-existe.png` devolve 404;
- `curl -sI -H 'Accept-Encoding: gzip' localhost:4000/` traz `Content-Encoding: gzip`;
- `curl -sI localhost:4000/custom-sw.js` traz `no-cache`.

---

### P-03 · GraphQL via POST fica fora do transfer cache: o SSR busca e o cliente busca de novo — **Média**

`app.config.ts:42` + `book.service.ts:145,258,349`

```ts
withHttpTransferCacheOptions({ includePostRequests: false }),
```

```ts
.post<{ data: Record<string, unknown> }>('graphql', {
```

**Mecanismo.** Home e catálogo carregam por `POST /graphql`, e o transfer cache exclui POST por
configuração [F4]. O servidor faz a consulta para renderizar, o cliente refaz a mesma consulta ao
hidratar, e o conteúdo pisca se a resposta mudar. O `ng-state` medido em 3.5 só contém os dois GETs.

**Reprodução:** com Network aberto, recarregar `/home`: as requisições `graphql` saem do navegador
logo após a hidratação, apesar de o HTML já ter os livros.

**Correção:** `includePostRequests: true` com um `filter` restrito a `/graphql` de consultas
públicas. Ou trocar essas consultas por GET com `?query=`, que o transfer cache já aceita.
**Critério de aceite:** o `<script id="ng-state">` da home contém uma chave cujo `u` termina em
`/graphql`, e o Network não mostra `graphql` antes da primeira interação.

---

### P-04 · `groupBy` sem *duration* e object URLs nunca revogados — **Baixa**

`reading-progress.service.ts:52-55` + `book.service.ts:486`

```ts
groupBy((data) => `${data.userId}_${data.chapterId}`),
mergeMap((group) => group.pipe(debounceTime(1000))),
```

**Mecanismo.**
- **Grupos que nunca encerram.** Cada par usuário/capítulo cria um grupo com `debounceTime` que
  vive pela sessão inteira. No login medido, 114 capítulos foram sincronizados; isso
  implica 114 grupos vivos [modelado — inferido do código, não contado no *heap*].
- **Blobs presos na memória.** `URL.createObjectURL` por capa em `getOfflineBooks` nunca é
  revogado, o que retém os blobs.

**Custo [modelado]:** dezenas de kB por centena de capítulos — baixo, mas cresce sem limite.

**Reprodução:** *heap snapshot* depois de abrir a biblioteca offline duas vezes: os `Blob` de capa
dobram.

**Correção:** `groupBy(key, { duration: (g) => g.pipe(debounceTime(1000)) })` e `revokeObjectURL`
no `ngOnDestroy` de quem consome as capas.
**Critério de aceite:** um teste de `ReadingProgressService` com 200 capítulos distintos afirma que,
após `tick(1000)`, o número de assinaturas internas ativas volta a 0. Verificável espiando
`debounceTime` com um *scheduler* de teste.

---

## 7. Usabilidade

### U-01 · Voltar a rede recarrega a página inteira, inclusive no leitor — **Alta**

`network-status.service.ts:118-126`

```ts
// Não recarrega se estiver na página de chapters
const currentUrl = this.router.url;
const isOnChaptersPage = currentUrl.includes('/chapters/');

if (!isOnChaptersPage) {
	window.location.reload();
}
```

**Mecanismo.** A rota real do leitor é `books/:id/:chapter` (`app.routes.ts:84`) e nunca contém
`/chapters/`, então a exceção nunca casa. Qualquer oscilação de rede recarrega a página: perde
formulário aberto, posição de scroll e o progresso que ainda estava no debounce de C-05.

**Reproduzido** (3.7, sessão logada, `:4200`):

| Passo | Resultado |
|---|---|
| Marcar `window.__auditSentinel` no leitor | presente |
| Emular Offline por 3 s → Online | — |
| 5 s depois | `__auditSentinel: null`, `navigation.type: "reload"`, `timeOrigin` novo |

**Reprodução:** a da tabela acima.

**Correção:** remover o `reload`. Os consumidores já reagem a `wentOnline$` (MQTT, sincronização),
e o recarregamento não tem função que eles não cubram. Se alguma tela precisar refazer dados, ela
assina `wentOnline$`.
**Critério de aceite:** o mesmo procedimento termina com `__auditSentinel` preservado e
`navigation.type === "navigate"`.

---

### U-02 · Página do livro publica `canonical` para `example.com`, e `og:site_name` duplica — **Alta**

`book.component.ts:352-357` + `meta-data.service.ts:34-38,60-71`

```ts
this.metaService.setMetaData({
	title: b.title,
	description: b.description,
	image: b.cover,
	url: `https://example.com/books/${b.id}`,
});
```

```ts
this.metaService.addTag({ property: 'og:site_name', content: resolvedTitle });
this.metaService.addTag({ name: 'twitter:site', content: resolvedTitle });
```

**Mecanismo.**
- **Canonical para outro domínio.** O *placeholder* do exemplo ficou no código: `setUrl` grava
  `og:url`, `twitter:url` **e** `<link rel="canonical">`. Um canonical para outro domínio diz aos
  buscadores que a página do livro é duplicata de `example.com`, o que tira do índice a página mais
  importante do catálogo.
- **Metas acumuladas.** `setTitle` usa `addTag` fora de `managedTags`, então `og:site_name` e
  `twitter:site` acumulam a cada navegação e recebem o título da página, e não o nome do site.

**Medido** na sessão logada:

```text
og:site_name=Gatuno · og:site_name=Test Download FINAL V2 | Gatuno
twitter:site=Gatuno · twitter:site=Test Download FINAL V2 | Gatuno
og:url=https://example.com/books/4702d8ed-b521-…
```

**Reprodução:** abrir qualquer `/books/:id` e executar
`document.querySelector('link[rel=canonical]').href`.

**Correção:**
- Montar a URL a partir de uma origem pública configurável (`environment.publicURL`) ou do
  `REQUEST` no SSR.
- `setTitle` passa a usar `updateTag`, com `og:site_name` fixo em "Gatuno".
- 17 arquivos de `pages/` chamam `setMetaData`, e o `NavigationEnd` (`meta-data.service.ts:34-38`)
  reseta as metas; nas páginas que chamam no construtor, a ordem pode apagar as metas [modelado].
  Mover o padrão para `title`/`resolve` de rota.
**Critério de aceite:** `curl -s localhost:4000/books/<id> | grep -c 'example.com'` devolve 0, e
`document.querySelectorAll('meta[property="og:site_name"]').length === 1` depois de três navegações.

---

### U-03 · Sem rota `**`: URL desconhecida dá tela em branco, e `/auth` redireciona para `404` inexistente — **Média**

`app.routes.ts` + `auth.routes.ts:6-11`

```ts
{ path: '', pathMatch: 'full', redirectTo: '404' },
```

```bash
grep -rn "path: '\*\*'" src/app
# → 0 resultados
```

**Mecanismo.** Uma URL desconhecida lança `NG04002`. No navegador **medido**, a página fica em
branco (o *snapshot* de acessibilidade contém só `RootWebArea "Gatuno"`). No servidor, devolve 200
(3.3), que os buscadores tratam como *soft 404*.

**Reprodução:** abrir `/rota-que-nao-existe`: tela vazia e `ERROR RuntimeError: NG04002` no console.

**Correção:** um componente `not-found` com `path: '**'`, e `status: 404` via
`ServerRoute`/`RESPONSE_INIT` (unidade com P-02). Em `auth.routes.ts`, redirecionar para `login`.
**Critério de aceite:** `curl -s -o /dev/null -w '%{http_code}' localhost:4000/rota-que-nao-existe`
devolve 404, e o *snapshot* do navegador contém o texto "Página não encontrada".

---

### U-04 · `app-icon-button`: `aria-label` no *host*, `<button>` interno sem nome — **Média** (WCAG 4.1.2)

Medido pelo Lighthouse mobile na home anônima (`button-name` e `aria-prohibited-attr`, 2 nós cada):

```html
<app-icon-button name="list" size="24px" aria-label="Abrir menu">
  <button class="icon-button ghost" type="button">
```

**Mecanismo.** O `aria-label` fica num elemento sem *role* (proibido, e ignorado pelos leitores de
tela), e o `<button>` focável não tem nome acessível. O leitor anuncia só "botão". O relatório
irmão `inputs-atoms` (U-14) registrou o mesmo padrão no `button`; o `icon-button` repete o defeito.
O Lighthouse também reprova `color-contrast` em parágrafos da home.

**Reprodução:** rodar o Lighthouse mobile na home (relatório em `scratchpad/lh-anon/report.json`).

**Correção:** um `ariaLabel = input<string>()` no `icon-button`, repassado como
`[attr.aria-label]` ao `<button>` interno, e retirado dos usos no *host*.
**Critério de aceite:** o Lighthouse na home sem `button-name` nem `aria-prohibited-attr`
reprovados.

---

## 8. Engenharia: testes, CI, tooling e estrutura

### Q-01 · CI vermelho no HEAD, e o commit seguinte entrou por cima — **Alta**

`reading-progress-sync.service.ts:128` × `reading-progress-sync.service.spec.ts:60-66`

```ts
this.mqttConnectionSubscription = this.mqttService.connected$.subscribe(
```

```ts
const mqttSpy = jasmine.createSpyObj('MqttService', ['connect', 'disconnect', 'isConnected'],
	{ progressSynced$: new Subject<SyncResponse>() });
```

**Mecanismo.** O commit `1437df3` passou a assinar `connected$`, o mock não tem essa propriedade, e
os 6 testes do serviço quebram no construtor (3.2). O `864a1e3` foi commitado 13 min depois, sobre o
vermelho. Não há execução de CI para `1437df3` — os dois subiram no mesmo *push* — e a
execução de `864a1e3` falhou sem efeito algum. Isso indica que a `developer` não tem proteção de branch exigindo o status do CI.

**Reprodução:** `npx ng test --browsers=ChromeHeadlessCI --watch=false` → `6 FAILED`.

**Correção:**
1. Acrescentar `connected$: of(false)` ao mock.
2. Exigir o job `ci` como *required status check* em `developer` e `main`.
**Critério de aceite:** a suíte termina `388 SUCCESS`, e
`gh api repos/:owner/:repo/branches/developer/protection` lista o check `ci`.

---

### Q-02 · Os serviços mais arriscados não têm teste, e parte dos testes não pode falhar — **Alta**

`http-client-request.interceptor.spec.ts:7-8` + `karma.conf.js:12-14`

```ts
it('should be defined', () => {
	expect(HttpClientRequestInterceptor).toBeDefined();
});
```

```js
client: { jasmine: {}, clearContext: false },
```

**Mecanismo.**
- **Sem spec nenhum:** os oito serviços que concentram os achados desta seção 5: `csrf`,
  `auth-queue`, `download`, `download-manager`, `reading-progress`, `unified-reading-progress`,
  `account-security` e `network-status`. Também não têm: `server.ts`, `custom-sw.js` e o
  ref-counting de MQTT (0 ocorrências, C-06).
- **Testes que não falham.** De 388 `it`, 63 são `should create`/`should be defined`. O interceptor
  de request, que monta `Authorization`, decide CSRF e define "requisição interna", tem só um
  `toBeDefined`.
- **Asserções que podem não rodar.** Várias asserções ficam dentro de `subscribe({ error: … })`, por
  exemplo `http-client-response.interceptor.spec.ts:92-96`, e passam em silêncio se o Observable
  completar sem erro, porque `failSpecWithNoExpectations` está desligado.

**Reprodução:** `grep -rhE "it\('(should )?(create|be created|create an instance|be defined)" src --include='*.spec.ts' | wc -l`
→ 63.

**Correção:**
1. `jasmine: { failSpecWithNoExpectations: true }`.
2. Specs para o interceptor de request (URL interna × externa × `//host`, CSRF por método) e para
   C-02, C-04, C-05 e C-06, usando os critérios de aceite deste relatório como casos.
3. Cobertura com *threshold* no CI, começando pela linha atual.
**Critério de aceite:** a suíte quebra se um `it` não tiver `expect`, e cada critério de aceite dos
achados C-02 a C-06 existe como teste nomeado.

---

### Q-03 · Testes com zone.js e webpack; produção *zoneless* com esbuild; Karma descontinuado — **Média**

`angular.json:118-120`

```json
"builder": "@angular-devkit/build-angular:karma",
"options": { "polyfills": ["zone.js", "zone.js/testing"],
```

**Mecanismo.** A produção roda *zoneless* (`app.config.ts:34`, `polyfills: []`), mas a suíte roda
com zone.js e nenhum spec usa `provideZonelessChangeDetection`. Os defeitos de detecção de mudança
que só existem sem zone, justamente os que os relatórios irmãos encontraram, não podem aparecer
nos testes. O Karma está descontinuado e "not accepting new features or general bug fixes" [F15].
O Angular publica o caminho de migração para Vitest, com o *schematic*
`refactor-jasmine-vitest` [F6].

**Reprodução:** `grep -rln provideZonelessChangeDetection src --include='*.spec.ts'` → 0 arquivos.

**Correção:** migrar para `@angular/build:unit-test` com Vitest [F6], e incluir
`provideZonelessChangeDetection()` no `TestBed` global.
**Critério de aceite:** `angular.json` sem `zone.js` em nenhum `polyfills`, e
`grep -c zone.js package.json` devolve 0.

---

### Q-04 · O Biome ignora todos os templates, e *warnings* não falham o CI — **Média**

`biome.json:51`

```json
"!**/*.html",
```

**Mecanismo.** Os 76 templates externos não passam por lint. As regras de acessibilidade
configuradas (`useAltText`, `useButtonType`, `useAnchorContent`) não têm onde agir, o que explica
por que defeitos como U-04 chegam ao Lighthouse. A única *warning* atual (3.8) passa no CI porque o
`biome check` não usa `--error-on-warnings`.

**Reprodução:** `npx biome check .` → `Found 1 warning`, exit 0.

**Correção:** remover a exclusão de `*.html`, já que o Biome 2.x tem suporte a HTML, e corrigir em
lote. Mudar o script `lint` para `biome check --error-on-warnings .`.
**Critério de aceite:** `npm run lint` sai com código diferente de 0 enquanto houver o import não
usado em `mqtt.service.spec.ts:9`.

---

### Q-05 · *God classes*: `info-book` com 2.561 linhas, `BookService` com seis papéis — **Média**

`info-book.component.ts` + `book.service.ts:46-58`

```ts
if (typeof window !== 'undefined') {
	this.ngZone.runOutsideAngular(() => {
		setTimeout(() => { … this.websocketService.connect(); … }, 2000);
```

**Mecanismo.**
- **`info-book`.** O componente tem 2.561 linhas, 15 `inject()`, 21 `signal(` e 29 `.subscribe(`,
  e mistura capas, download, comentários, relacionamentos, páginas salvas, menu de contexto e MQTT.
  Já atraiu um *codemod* local (`fix-info-book.py`) para ser editável.
- **`BookService`.** Mistura REST, GraphQL montado por string, filtragem offline, download por
  `fetch` e fachada de tempo real. Também **abre a conexão MQTT como efeito colateral do
  construtor**: injetar o serviço de dados liga o tempo real.
- **Cinco arquivos acima de 800 linhas** concentram a maior parte dos achados de correção.

**Reprodução:** `wc -l src/app/features/books/components/info-book/info-book.component.ts` → 2.561.

**Correção:** extrair o efeito colateral do construtor para um `APP_INITIALIZER`/`effect` explícito
de "sessão ativa ⇒ MQTT". Dividir o `info-book` pelas abas que ele já tem, um componente por aba
com o próprio estado. Não é refatoração para fazer de uma vez; fazer por aba, ao mexer em cada uma.
**Critério de aceite:** `grep -n "websocketService.connect" src/app/core/services/book.service.ts`
devolve 0 linhas, e nenhum arquivo `.component.ts` passa de 800 linhas
(`find src -name '*.component.ts' | xargs wc -l | sort -rn | sed -n 2p`).

---

### Q-06 · `Dockerfile.prod` checa `localhost:3001`, mas o padrão é `3000`; `generate-env.ts` interpola sem escape — **Média**

`Dockerfile.prod:24-28` + `generate-env.ts:36-42`

```dockerfile
RUN npm run build \
	&& if grep -R --line-number --fixed-strings "localhost:3001" dist/front/browser; then \
```

```ts
apiURL: '${process.env.API_URL || 'http://localhost:3000'}/api',
```

**Mecanismo.**
- **A guarda não guarda nada.** Ela procura uma porta que o código não usa. Se `vars.API_URL`
  faltar no CI (`ci.yml:57`), a imagem é publicada apontando para `localhost:3000` sem erro algum.
- **Interpolação sem escape.** O valor da variável entra numa string TS sem escape, então um `'`
  quebra o build, e um valor controlado injeta código no bundle.

**Reprodução:** `API_URL= npm run build && grep -c "localhost:3000" dist/front/browser/*.js` → > 0,
com a checagem do Dockerfile passando.

**Correção:** gerar com `JSON.stringify(value)`, falhar o `generate-env.ts` em produção se
`API_URL` não estiver definida, e corrigir a guarda para `localhost`.
**Critério de aceite:** `docker build -f Dockerfile.prod .` sem `--build-arg API_URL` falha.

---

### Q-07 · Higiene: codemods versionados, 7,5 MB no histórico, `.gitignore` com nome errado, commitlint inoperante — **Baixa**

`.gitignore:46` + `lefthook.yml` + `package.json:3`

```text
test_output.txt          ← .gitignore:46; o arquivo real é test-output.txt
"version": "0.8.0"       ← package.json:3; a última tag é v1.4.1
```

**Mecanismo.**
- **Lixo versionado:** codemods e diagnósticos de uso único (`scripts/standardize-blur.js`,
  `scripts/test-cors-vary.js`).
- **Histórico pesado:** um perfil do Firefox de 7,5 MB entrou em `7528be1` e saiu depois, mas o pack
  tem 31,57 MiB.
- **Commitlint só no papel:**
  - existe `.commitlintrc.json`, mas `@commitlint/*` não está instalado;
  - o `lefthook.yml` não tem hook `commit-msg`;
  - o `scope-enum` não inclui os escopos que o histórico usa (`front`, `auth`, `perf`).
- **Release desligado do pacote:** o `semantic-release` não atualiza o `package.json`.

**Reprodução:** `git count-objects -vH | grep size-pack` → `31.57 MiB`;
`ls node_modules/@commitlint` → não existe.

**Correção:**
- Corrigir o nome no `.gitignore`.
- Remover os scripts de uso único.
- Instalar o commitlint com hook ou apagar a config.
- Usar `@semantic-release/npm` com `npmPublish: false`.
- Reescrever o histórico só se o tamanho do *clone* incomodar; é opcional.
**Critério de aceite:** `git check-ignore test-output.txt` devolve o arquivo, e
`git commit -m "x"` é rejeitado pelo hook.

---

### Q-08 · Documentação contraditória e 44 usos de `NgZone` sem efeito — **Baixa**

`GEMINI.md:82,84` × `AURORA_DESIGN.md:84` + `README.md:3`

```text
GEMINI.md:82        NEVER use `filter: blur()` with large radii (e.g. `blur(40px)`, `blur(90px)`)
AURORA_DESIGN.md:84 filter: blur(90px);
README.md:3         This project was generated using Angular CLI version 19.2.3.
```

**Mecanismo.**
- **Dois guias, ordens opostas.** O código segue o AURORA: `blur(90px)` em `home.component.scss:22`,
  `auth/outlet/outlet.component.scss:23` e `book.component.scss:94`.
- **Regra que não se aplica mais.** O `GEMINI.md:84` exige `ngZone.runOutsideAngular`, que não faz
  nada num app *zoneless*. Hoje são 44 ocorrências de `NgZone`/`runOutsideAngular` em 13 arquivos,
  com comentários que afirmam um efeito inexistente.
- **Referências a arquivos que não existem:** `book-websocket.service.ts`, `src/app/components/` e
  `graphql.json`.
- **README sem conteúdo do projeto:** ainda é o template do CLI.

**Reprodução:** `grep -rn "runOutsideAngular\|NgZone" src/app --include='*.ts' | grep -v spec | wc -l` → 44.

**Correção:** um guia canônico, com a regra de *blur* do relatório irmão de micro-interações. Remover
a regra de `NgZone` e as chamadas, como faxina e sem urgência. Um README com *setup*, variáveis e
arquitetura.
**Critério de aceite:** `grep -c "runOutsideAngular" GEMINI.md` devolve 0, e
`grep -c "Angular CLI version" README.md` devolve 0.

---

### Q-09 · Dependências mal classificadas ou sem uso, e provider *deprecated* — **Baixa**

`package.json:31,47,40-41` + `app.config.ts:44`

```ts
provideAnimationsAsync(),
```

**Mecanismo.**
- **Sem uso no código:** `@angular/platform-browser-dynamic` e `ngx-cookie-service-ssr` (knip, 3.8).
- **Na seção errada:** `zone.js` só é usado em teste e está em `dependencies`; `@types/cookie-parser`
  também está em `dependencies`.
- **Provider *deprecated* sem consumidor:** `provideAnimationsAsync` é
  `@deprecated 20.2 … Intent to remove in v23`
  (`node_modules/@angular/platform-browser/types/animations-async.d.ts`), e nenhum `animations: [`
  existe no código. Ele mantém `@angular/animations` no grafo.

**Reprodução:** `npx knip` → `Unused dependencies (2)`.

**Correção:** remover o provider e as duas dependências, e mover `zone.js` e `@types/cookie-parser`
para `devDependencies`. Isso vale até a migração de Q-03 remover o `zone.js` de vez.
**Critério de aceite:** `npx knip` sem a seção `Unused dependencies`.

---

### Q-10 · Estilo contra o próprio guia: 39 `::ng-deep`, 85 `!important`, 278 cores fixas — **Baixa**

`styling-guidelines.md:7`

```text
**NUNCA use cores hardcoded (hex, rgb, rgba explícitos) no CSS dos componentes.**
```

**Mecanismo.** As cores fixas quebram os temas `dark`/`true-dark`. Os relatórios irmãos medem o
efeito por componente; aqui fica só a contagem global, para acompanhar a tendência.

**Reprodução:**
- `grep -rnoE "#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[0-9]" src --include='*.scss' | wc -l` → 278;
- `grep -rn "::ng-deep" src --include='*.scss' | wc -l` → 39;
- `grep -rn '!important' src public/assets/scss --include='*.scss' | wc -l` → 85.

**Correção:** uma regra de lint de estilo (Stylelint `color-no-hex` + `declaration-no-important`) em
modo *warning*, com o número atual como teto que só pode descer.
**Critério de aceite:** o CI falha se a contagem de cores fixas passar de 278.

---

## 9. Achado transversal: a configuração declara o que o runtime não faz

Seis achados têm a mesma causa. Em cada um, o repositório **declara** um comportamento que o código
em execução não tem, e quem lê a declaração conclui que o problema está resolvido:

| Declaração | Realidade | Achado |
|---|---|---|
| `renderMode: Client`, `cache.ttl` nas rotas | tudo SSR, nenhum cache | C-01 |
| "fix: correct MQTT topic ref-counting" | ref-count vaza por três vias, sem teste | C-06 |
| logger "Produção: Apenas WARN e ERROR" | logger desligado em produção | C-11 |
| `@deprecated Use syncBook instead` | `syncBook` não tem chamador | C-09 |
| `.commitlintrc.json`, `failSpec…` não ligado, guarda `localhost:3001` | nenhuma das três checa algo | Q-02, Q-06, Q-07 |
| `GEMINI.md` exige `runOutsideAngular` | sem efeito em *zoneless* | Q-08 |

A segunda cadeia é de segurança e precisa ser corrigida **em ordem**:

```text
S-02 (XSS no leitor HTML) → S-03 (JWT legível por JS, sem CSP) → roubo de sessão de 15 min,
renovável enquanto o refresh cookie valer
C-10 corrigido com SSR autenticado → GHSA-q6f4 [F2] na 21.0.1 → dados do usuário no HTML do SSR
```

Corrigir C-10 pelo caminho (b) **antes** de S-01 transforma um defeito de UX num vazamento de
dados. Por isso o backlog coloca S-01 primeiro.

**Recomendação:** cada declaração da tabela vira uma verificação executável — um teste, um passo
de CI ou uma asserção de build —, ou é apagada. Declaração sem verificação nesta base de código tem
se mostrado falsa com mais frequência do que verdadeira.

---

## 10. O que está bem feito

| Local | Decisão |
|---|---|
| `tsconfig.json` | `strict`, `strictTemplates`, `noPropertyAccessFromIndexSignature`; 0 `any`, 0 `@ts-ignore` e 0 `!` em produção |
| 78/78 componentes | `OnPush`, `input()`/`output()`, controle de fluxo novo; 0 `@Input`, 0 `*ngIf` |
| `app.config.ts:34` + `angular.json:23` | *zoneless* real no build, com `polyfills: []` |
| `user-token.service.ts:215-217` | refresh token fora do alcance do JS; refresh compartilhado com `shareReplay` (`:325-354`) |
| `http-client-response.interceptor.ts:20-39` | fila de 401, exclusão das rotas de auth, logout só em 401/403 |
| `server.ts:61` | o cookie `theme` é validado antes de entrar no HTML (só falta aceitar mais valores, C-10) |
| `ngx-markdown` sem override de `SANITIZE` | comentários e descrições sanitizados |
| `ngsw-config.json` sem `dataGroups` | o SW nunca cacheia respostas da API |
| `Dockerfile.prod:30-43` | *multi-stage*, `USER node`, só o `dist` na imagem final |
| Bundle inicial de 565 kB | mqtt, pdfjs e ECharts fora do caminho crítico (3.1) |
| Nenhum estado mutável em escopo de módulo | sem vazamento entre requisições SSR |

Hipóteses refutadas nesta sessão, registradas para não voltarem:

> **`.env` versionado / segredos no histórico** — `git ls-files .env` → nada; busca por padrões de
> segredo no `git log -p` → 0.
>
> **`TransferState` vazando dados do usuário** — refutado no estado atual (3.5).
>
> **Vazamento de memória pelo `pageIsSSG`** — RSS estável em 12 mil URLs (3.6).
>
> **Host forjado refletido no HTML** — 0 ocorrências (3.3).

---

## 11. Backlog priorizado

> Ordenado por (impacto no usuário × alcance) ÷ esforço. Os itens de segurança vêm antes quando
> há dependência de ordem (seção 9).

| Pri | Item | Esforço | Alcance | Tipo |
|---|---|---|---|---|
| 1 | **S-01** — `npm update` dentro dos *ranges* + `npm audit` no CI | XS | Todos | Correção |
| 2 | **Q-01** — mock `connected$` + *required check* | XS | Processo | Qualidade |
| 3 | **U-01** — remover o `reload` ao voltar a rede | XS | Celular | UX |
| 4 | **U-02** — URL canônica real + `updateTag` nas metas | XS | SEO | UX |
| 5 | **S-02** — remover `bypassSecurityTrustHtml` | XS | Leitores HTML | Correção |
| 6 | **S-04 + C-01 + P-02 + U-03** — `AngularNodeAppEngine`, `app.routes.server.ts`, `allowedHosts`, helmet, compressão, 404 real | M | Servidor | Arquitetura |
| 7 | **C-02 + C-05** — progresso: retorno remoto, `Map` de pendentes, *flush* em `visibilitychange` | S | Logados | Correção |
| 8 | **C-04** — Web Locks, política única de logout, signal com expiração | S | Logados | Correção |
| 9 | **S-03** — access token HttpOnly (exige backend) + CSP | M | Logados | Correção |
| 10 | **C-03 + C-06** — MQTT: `transformWsUrl`, `isAuthError`, ref-count no *subscribe* | S | Logados | Correção |
| 11 | **P-01** — `installMode: lazy` + preload seletivo | XS | Celular | Perf |
| 12 | **Q-02** — `failSpecWithNoExpectations` + specs dos itens 3, 7, 8 e 10 | M | Processo | Qualidade |
| 13 | **S-08** — CI com SHA, `permissions`, segredos explícitos | XS | Supply chain | Correção |
| 14 | **S-05, S-06, S-07, S-10** — `openExternal`, fila sem token, logout local, guards | S | Logados | Correção |
| 15 | **C-07 + C-08 + C-09** — SW de sync, migração do IDB, `persist()`, download parcial | M | Offline | Correção |
| 16 | **Q-06** — guarda de build e `JSON.stringify` no env | XS | Deploy | Qualidade |
| 17 | **Q-03 + Q-04** — Vitest *zoneless*; Biome nos templates | L | Processo | Qualidade |
| 18 | **C-10, C-11, P-03, U-04** — decisão de SSR, logger/ErrorHandler, GraphQL GET, `icon-button` | S | Variado | Correção/A11y |
| 19 | **Q-05, Q-07–Q-10, S-09, S-11, S-12, C-12, P-04** — faxina estrutural, por oportunidade | L | — | Qualidade |

Agrupamentos:
- **Item 6.** É uma unidade porque os quatro achados mudam o mesmo `server.ts` e a mesma
  configuração de servidor; separá-los significaria reescrever o servidor duas vezes.
- **Item 7.** É uma unidade porque os dois caminhos do progresso compartilham o mesmo estado
  (`pendingSyncData`, `lastSyncAt`), e corrigir um sem o outro muda o sintoma sem eliminar a perda.

Os itens 1 a 5 somam menos de meio dia de trabalho. Eles fecham o advisory crítico, devolvem ao CI
a capacidade de bloquear regressões, eliminam a única perda de estado **reproduzida** e o dano de SEO
**medido**, e removem o vetor de XSS.

O item 11 é o único de desempenho com efeito amplo. Aplicá-lo isolado e medir de novo no protocolo
de 3.4 antes de qualquer outro ajuste de bytes.

---

## 12. Riscos e o que falta verificar

1. **O proxy reverso de produção define a severidade real de S-01, S-04 e P-02.** Verificar se ele
   repassa ou reescreve o `Host`, se aceita `X-Forwarded-*` do cliente, se comprime, e se cacheia
   HTML. Se cachear HTML, C-10 (b) precisa de `Cache-Control: private` antes de ser implantado.
2. **Nenhum achado de MQTT foi disparado.** O broker local estava desligado. Antes de corrigir C-03
   e C-06, reproduzi-los com o broker ativo, seguindo as linhas de Reprodução.
3. **Nenhum número de tempo de navegador foi medido com dados reais.** O CORS restringe a API ao
   `:4200`. Antes de aceitar P-01 como prioridade, liberar `:4100` no CORS de dev e repetir 3.4 com
   n = 5 em perfil Celular (Slow 4G, CPU 4×).
4. **S-03 e S-07 dependem do backend.** Se o backend autentica por cookie, o logout por GET é CSRF
   explorável. Se não autentica, S-03 exige mudança no backend para emitir o cookie HttpOnly.
   Confirmar no repositório da API.
5. **C-02, C-04 e C-05 vêm da leitura do código.** Os passos de reprodução precisam de dois
   dispositivos ou de manipulação de relógio. Os critérios de aceite são testes, e escrevê-los é
   também a verificação.
6. **Safari/iOS não foi testado.** A eviction de armazenamento (C-08) e os limites de Background
   Sync (C-07) são mais agressivos no WebKit [modelado].
7. **Q-01 e S-01 se corrigem em conjunto.** Corrigir só o mock deixa o CI verde com 26
   vulnerabilidades; corrigir só as dependências mantém o CI vermelho e esconde regressões da
   atualização.

---

## 13. Fontes consultadas

| # | Fonte | Tipo | Versão | Consultada em | Sustenta |
|---|---|---|---|---|---|
| F1 | [GHSA-x288-3778-4hhx — Angular SSR SSRF/Header Injection](https://github.com/advisories/GHSA-x288-3778-4hhx) | Issue | `@angular/ssr` < 21.1.5 | 2026-10-04 | S-01, S-04 |
| F2 | [GHSA-q6f4-qqrg-jv6x — HttpTransferCache com credenciais](https://github.com/advisories/GHSA-q6f4-qqrg-jv6x) | Issue | `@angular/common` < 21.2.15 | 2026-10-04 | 3.5, C-10, seção 9 |
| F3 | [Angular — Security: SSRF, `allowedHosts`, CSP/`autoCsp`](https://angular.dev/best-practices/security) | Doc oficial | 21.x/22.x | 2026-10-04 | S-01, S-03, 2.4 |
| F4 | [Angular — SSR: `withRoutes`, `RenderMode`, `AngularNodeAppEngine`, transfer cache](https://angular.dev/best-practices/performance/ssr) | Doc oficial | 21.x/22.x | 2026-10-04 | S-04, C-01, P-03 |
| F5 | [Angular — `CommonEngineOptions` (deprecated since v22)](https://angular.dev/api/ssr/node/CommonEngineOptions) | Doc oficial | 22.x | 2026-10-04 | S-04 |
| F6 | [Angular — Migrating from Karma to Vitest](https://angular.dev/guide/testing/migrating-to-vitest) | Doc oficial | 21.x | 2026-10-04 | Q-03 |
| F7 | [Express — Version support](https://expressjs.com/en/support) | Doc oficial | 4.x/5.x | 2026-10-04 | S-01 |
| F8 | [MQTT.js README — `transformWsUrl` e credenciais no reconnect](https://github.com/mqttjs/MQTT.js/blob/main/README.md) | Doc oficial | 5.x (instalado 5.15.1) | 2026-10-04 | C-03 |
| F9 | [MDN — `Window.open()` e `noopener`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) | Doc oficial | — | 2026-10-04 | S-05 |
| F10 | [MDN — `StorageManager.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) | Doc oficial | — | 2026-10-04 | C-08 |
| F11 | [`idb` README — `openDB`, `upgrade(oldVersion)`, `blocked`, `blocking`](https://github.com/jakearchibald/idb/blob/main/README.md) | Exemplo do mantenedor | 8.x (instalado 8.0.3) | 2026-10-04 | C-08 |
| F12 | [MDN — `pagehide` / `visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event) | Doc oficial | — | 2026-10-04 | C-05 |
| F13 | [OWASP — HTML5 Security Cheat Sheet (armazenamento de sessão)](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) | Doc oficial | — | 2026-10-04 | S-03, 2.4 |
| F14 | [GitHub Docs — Secure use reference (SHA, `permissions`, self-hosted)](https://docs.github.com/en/actions/reference/security/secure-use) | Doc oficial | — | 2026-10-04 | S-08, 2.4 |
| F15 | [Karma README — aviso de descontinuação](https://github.com/karma-runner/karma) | Doc oficial | 6.4 | 2026-10-04 | Q-03 |

As páginas F3–F6 foram consultadas via Context7 (`/websites/angular_dev`), que indexa a versão
corrente do angular.dev (22.x). Toda API recomendada foi conferida no pacote **instalado**:
- `withRoutes`/`RenderMode` exportados por `@angular/ssr` 21.0.1;
- `transformWsUrl` em `mqtt/build/lib/client.d.ts:65`;
- a ausência de `allowedHosts` em `@angular/ssr` 21.0.1 (S-01).

---

> Nenhum item deste relatório foi executado em produção nem atrás do proxy reverso real. As
> medições vêm de um build de produção servido localmente (Node 26, não o 24 do CI), de um dev
> server para a sessão logada e de um navegador sem *throttling* com n = 1. O broker MQTT, o
> Safari/iOS e o backend ficaram fora; os itens que dependem deles estão listados na seção 12.
