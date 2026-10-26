# Análise Técnica — telas do `gatuno/web` (consistência visual, usabilidade e acessibilidade)

**Data:** 2026-10-13 · **Branch:** `developer` · **Commit base:** `0a7e1bb`
**Escopo:** as 20 telas roteadas em `src/app/app.routes.ts` — públicas, `/auth`, `/user/*` e
`/dashboard/*` —, vistas pela interface, no tema escuro, a 1440 px de largura
**Relatórios irmãos:** [`auditoria-repositorio`](./2026-10-04-auditoria-repositorio.md) ·
[`inputs-atoms`](./2026-08-23-inputs-atoms-performance-usability.md) ·
[`micro-interações`](./2026-08-23-micro-interacoes-animacoes-blur.md)

---

## 1. Sumário executivo

Este relatório nasce da recriação das 20 telas no Figma (página "Implementação atual" do arquivo
`QlUrvomONqwfefHCwTg0Hh`). Para isso, cada rota foi aberta no app rodando contra o backend de dev,
capturada e comparada com o código. Os relatórios irmãos cobrem segurança, performance e os átomos
de input. Este cobre o que aparece na tela: identidade visual, coerência entre áreas, textos e
acessibilidade dos controles.

O sistema de tokens é sólido: cinco temas completos em `_color-definitions.scss:3,68,133,194,241`
e uma diretriz escrita (`styling-guidelines.md`). O problema é que as telas **não seguem** o que
os próprios documentos do projeto definem. A fonte de corpo nunca é aplicada, o padrão visual
"Aurora" cobre 3 de 20 telas, e há 25+ valores distintos de raio para uma diretriz que pede um.

| # | Problema | Alcance | Severidade |
|---|---|---|---|
| V-01 | Inknut Antiqua (fonte de título) aplicada a todo o app; `--font-body` (Manrope) carregada e quase não usada | Todas as telas | Alta |
| U-02 | `app-select-cycle` (grade/lista/idioma/download) é `div` clicável: sem teclado, sem nome acessível | `/books` | Alta |
| U-01 | Textos de interface sem acento e com erros de digitação em menus e títulos | `/user/*`, perfil público, side-nav | Média |
| V-04 | Cores fora dos tokens no dashboard: neon `#00ff00`/`#ff0000`, paleta v5 do ECharts, texto `#aaa` | `/dashboard/*` | Média |
| U-04 | Raiz de 12 px no celular reduz todo `rem`; 34 regras ≤ 0,75 rem viram ≤ 9 px | Celular | Média |
| U-05 | Status interno de *scraping* ("Pronto") exibido a qualquer leitor em cada capítulo | `/books/:id` | Média |
| Q-02 | Recarregar `/dashboard` manda para `/home` mesmo com a permissão presente — **reproduzido**, causa não identificada | Admins | Média |

**Veredicto:** a fundação de tokens está acima da média, mas as telas foram construídas por fora
dela. O ganho maior não vem de redesenho. Vem de **aplicar o que já está decidido** nos
documentos do repositório: fonte de corpo, raio padrão e tokens semânticos.

---

## 2. Metodologia e limites

### 2.1 O que foi feito

- **Navegação real.** `ng serve` local, apontado para o backend de dev em Docker
  (`../api/docker-compose.common.yml` + `docker-compose.dev.yml`), com Chromium via Playwright MCP
  em viewport 1440 × 900 e tema `dark` forçado em `localStorage`. As rotas logadas usaram uma
  conta de teste criada em `/auth/register`, com a role `admin` concedida no banco de dev.
- **Captura e recriação.** Cada rota foi capturada para o Figma, medida nó a nó (tamanhos, fontes,
  cores) e reconstruída com componentes. Divergências entre a captura e o código foram resolvidas
  lendo o código. Duas delas viraram hipóteses refutadas (seção 7).
- **Leitura e busca.** Toda linha citada foi aberta nesta sessão. Contagens vêm de `grep` sobre
  `src/` e `public/assets/scss/`, com o comando ao lado.

### 2.2 O que NÃO foi feito — limites desta análise

> Nenhuma tela foi vista em celular, tablet, Safari ou nos temas `light`, `true-dark`, `dracula` e
> `slate`. Não houve leitor de tela nem auditoria automática (axe/Lighthouse). Os achados de
> acessibilidade vêm do código e da inspeção visual. Nenhum tempo foi medido. As telas logadas
> refletem uma conta nova, sem histórico, coleções ou sessões antigas.

### 2.3 Métricas de referência

| Métrica | Limiar | Fonte |
|---|---|---|
| Área de toque | ≥ 24 × 24 CSS px, ou espaçamento equivalente | WCAG 2.2 SC 2.5.8 (AA) [F1] |
| Operável por teclado | toda funcionalidade | WCAG 2.2 SC 2.1.1 (A) [F2] |
| Nome e papel acessíveis | todo componente de interface | WCAG 2.2 SC 4.1.2 (A) [F3] |
| Raio de inputs e dropdowns | `12px` (`0.75rem`), sem misturar variações | `styling-guidelines.md:137` |
| Cores em componentes | apenas tokens semânticos, nunca hex | `styling-guidelines.md`, seção 1 |

---

## 3. Evidências medidas

### 3.1 Raios: 25+ valores distintos para uma diretriz de um

```bash
grep -rhoE "border-radius: *[^;]+" --include='*.scss' src/app | sort | uniq -c | sort -nr
# → 8px ×47 · 12px ×36 · 50% ×29 · 4px ×27 · 10px ×25 · 6px ×8 · 0.75rem ×8 · 20px ×7
#   16px ×6 · 1.5rem ×6 · 5px ×5 · 2px ×5 · 15px ×4 · 14px ×4 · 9999px ×3 · 999px ×2
#   9999999px ×2 · 624.9375rem ×2 · …
```

`12px` e `0.75rem` são o mesmo valor escrito de dois jeitos. O mesmo acontece com quatro grafias
de "pílula": `9999px`, `999px`, `9999999px` e `624.9375rem`.

### 3.2 A fonte de corpo é carregada e não é usada

`_fonts.scss` declara 12 `@font-face` de Manrope (`:219-318`), e `_color.scss:4` a expõe como
`--font-body`. O consumo:

```bash
grep -rn "font-body\|Manrope" src --include='*.scss' --include='*.html'
# → book-review-form.component.scss:71 (var(--font-body))
#   chapter-comments.component.scss:97,286,331,401 ('Manrope' literal)
```

São 2 componentes. Os outros recebem a regra global `font-family: 'Inknut Antiqua'`
(`global.scss:13`). `--font-ui` (Plus Jakarta Sans) aparece só em login, register, no outlet de
`/auth` e nos comentários.

### 3.3 Cores literais concentradas no dashboard e nos comentários

```bash
grep -rcE "#[0-9a-fA-F]{3,6}\b" --include='*.scss' src/app | grep -v ":0" | sort -t: -k2 -nr
# → chapter-comments ×28 · monitoring ×18 · overlay-notification ×14 · icon-button ×10
#   sensitive-content ×9 · tags ×7 · document-reader ×7 · library ×6
```

### 3.4 Console durante a navegação

O contador do Playwright chegou a **91 erros e 115 avisos**, acumulados ao percorrer as rotas
logadas (n = 1, sem *reload* entre telas). A origem não foi analisada (seção 7, item 3).

---

## 4. Achados de consistência visual

### V-01 · Fonte de título aplicada ao app inteiro; fonte de corpo ociosa — **Alta**

`global.scss:13` + `_color.scss:3-6`

```scss
* { /* … */ font-family: 'Inknut Antiqua', serif; }   // global.scss:13
--font-display: "Inknut Antiqua", serif;               // _color.scss:3
--font-body: "Manrope", sans-serif;                    // _color.scss:4
```

A regra universal põe uma serifa de exibição em inputs, botões, tabelas e números. A Inknut tem
métricas verticais altas: um `h1` de 32 px ocupa 83 px de caixa (medido na captura de
`/latest-reads`). Isso infla botões e campos e explica alturas como os `select` de 62 px em
`/user/appearance`. A diretriz manda usar os tokens (`styling-guidelines.md`, seção 2), e o
próprio arquivo global os ignora. Quando um glifo falha, entra a fonte do sistema: "Ordenar
por:" em `/books` renderizou em Arimo.

| Alcance | Impacto |
|---|---|
| Todas as telas | Densidade baixa, alturas irregulares e leitura cansativa em textos longos (sinopse, descrições de configuração). |
| Celular | Agravado por U-04. |

**Reprodução:** abrir `/books` e inspecionar o `input` de busca: `font-family` computado é
`"Inknut Antiqua"`.

**Correção:** trocar a regra global para `var(--font-body)` e aplicar `var(--font-display)` só a
títulos. O precedente é o outlet de `/auth`, que já usa `--font-ui` para a interface
(`login.component.scss`, `register.component.scss`).
**Critério de aceite:** `grep -n "Inknut" public/assets/scss/global.scss` → 0 resultados, e o
`font-family` computado do `input` de `/books` começa por `Manrope`.

---

### V-02 · Duas linguagens visuais: "Aurora" em 3 telas, tema plano no resto — **Média**

`AURORA_DESIGN.md:9` declara o Aurora Glassmorphism como "a nova linguagem visual do Gatuno".

```bash
grep -rln "aurora-scene\|aurora-orb" src --include='*.html'
# → home.component.html · auth/outlet/outlet.component.html · book.component.html
```

O vidro completo (card translúcido, sombra, header com *blur*) existe só em `/auth`. A home e o
livro têm as orbes, mas os componentes continuam planos. O header também diverge: 60 px no app
(`header.component.scss:11`) contra 64 px no `/auth` (`outlet.component.scss:119`). O dashboard
introduz um terceiro padrão, a casca dupla (`db-card-shell` + `db-card-core`).

**Reprodução:** ir de `/auth/login` para `/books`. Muda o header, a tipografia (Plus Jakarta →
Inknut) e o tratamento das superfícies.

**Correção:** decidir se o Aurora é o padrão (e migrar por área) ou só um acento de entrada (e
corrigir o `AURORA_DESIGN.md`). Hoje o documento promete algo que 17 de 20 telas não entregam.
**Critério de aceite:** o `AURORA_DESIGN.md` lista as telas que adotam o padrão, e
`grep -rln "aurora-scene" src --include='*.html'` bate com essa lista.

---

### V-03 · Raio e formato de botão sem padrão — **Média**

`button.component.ts:31` + `styling-guidelines.md:137`

```ts
rounded = input<ButtonRounded>('full');   // button.component.ts:31 — padrão é pílula
```

```bash
grep -rhoE 'rounded="[a-z]+"' --include='*.html' src/app | sort | uniq -c
# → 14 small · 12 large · 3 medium (o resto usa o padrão 'full')
```

O mesmo `app-button` aparece como pílula (configurações, auth), raio 8 ("Ler agora", "Explorar
livros"), raio 5 ("Selecionar" e "Ordem Crescente" na página do livro) e raio 20 (Segurança). O
tamanho do texto varia entre 13,33, 14 e 16 px. A seção 3.1 mostra o inventário de raios.

**Reprodução:** comparar "Ler agora" (`/home`), "Restaurar Padrões" (`/user/readings`) e
"Selecionar" (`/books/:id`).

**Correção:** criar tokens `--radius-sm/md/lg/pill` e restringir `ButtonRounded` a eles, com um
padrão único.
**Critério de aceite:** o comando da seção 3.1 lista ≤ 6 valores distintos, todos via `var(--radius-*)`.

---

### V-04 · Dashboard com cores literais, primitivas neon e paleta da v5 do ECharts — **Média**

`monitoring.component.scss:101-118` + `_color.scss:20-21` + `home.component.ts:88,194,232`

```scss
&.waiting   { border-color: #f59e0b; }          // literal
&.completed { border-color: var(--green); }     // --green: #00ff00 (_color.scss:21)
&.failed    { border-color: var(--red); }       // --red:   #ff0000 (_color.scss:20)
```

Os tokens semânticos existem (`--success-color` e `--danger-color`, em
`_color-definitions.scss:34-36`), mas o monitoramento usa as primitivas puras. O resultado são
bordas neon no tema escuro. Nos gráficos, `textColor = '#aaa'` é fixo (`home.component.ts:88`) e
as barras fixam `#d48265` e `#5470c6` (`:194,232`). Essas cores são a paleta padrão da **v5** do
ECharts [F5], com a v6.1.0 instalada. A lixeira usa `#ff4757` (`tags.component.scss:164`,
`sensitive-content.component.scss:270,308`) em vez de `--danger-color`.

| Alcance | Impacto |
|---|---|
| Tema escuro | Neon destoa; o laranja da marca some nos gráficos. |
| Tema claro | `#aaa` sobre fundo `#eeeeee` (`_color-definitions.scss:134`) tende a contraste baixo. **Não medido.** |

**Reprodução:** abrir `/dashboard/monitoring` e `/dashboard/home` no tema escuro e depois no claro.

**Correção:** trocar as primitivas por `--success-color`/`--danger-color`/`--warning-color`. Nos
gráficos, ler os tokens com `getComputedStyle` e montar a paleta a partir deles.
**Critério de aceite:** `grep -nE "#[0-9a-fA-F]{3,6}|var\(--(green|red)\)"` em
`monitoring.component.scss` e `home.component.ts` → 0 resultados.

---

### V-05 · Título de página com seis estilos diferentes — **Baixa**

| Tela | Regra | Estilo |
|---|---|---|
| `/latest-reads` | `latest-reads.component.scss:16-18` | 2 rem, peso padrão |
| `/library` | `library.component.scss:10-14` | 2,25 rem, 800 |
| `/user/*` | `appearance.component.scss:5-7` (e mais 4 arquivos) | 2 rem, 300 |
| leitor | `chapters.component.scss:97-99` | 2,5 rem, `lighter` |
| `/dashboard/tags` e `/sensitive-content` | `tags.component.scss:39-41` | 2,5 rem, 800 |
| `/dashboard/monitoring` | `monitoring.component.html:3` | `h2` sem `h1` na página |

A mesma regra `h1 { font-size: 2rem; font-weight: 300; }` está **copiada** em 5 arquivos de
`pages/user/` (`grep -ln "^h1 {" src/app/pages/user/*/*.scss` → 5).

**Reprodução:** abrir `/library`, `/user/filter` e `/dashboard/tags` em sequência e comparar o `h1`.

**Correção:** uma classe ou mixin global de título de página, aplicada nas 20 rotas.
**Critério de aceite:** `grep -rn "^h1 {" src/app/pages --include='*.scss'` → 0 resultados.

---

### V-06 · Token inexistente `--text-color` em uso — **Baixa**

```bash
grep -rn "\-\-text-color:" public/assets/scss src
# → 0 resultados
grep -rn "var(--text-color)" src --include='*.scss'
# → library.component.scss:12,196,229 · chapter-group.component.scss:29
```

Sem *fallback*, a declaração é inválida no momento do cálculo e a cor volta a ser herdada. Hoje
funciona por acaso, porque o pai tem `--app-text-color`.

**Reprodução:** inspecionar o `h1` de `/library`: a regra `color: var(--text-color)` aparece como
inválida no DevTools.

**Correção:** trocar por `var(--app-text-color)`.
**Critério de aceite:** `grep -rn "var(--text-color)" src` → 0 resultados.

---

## 5. Achados de usabilidade e acessibilidade

### U-01 · Textos de interface sem acento e com erros — **Média**

| Texto exibido | Onde |
|---|---|
| "Aparencia", "Seguranca" | `user/outlet/outlet.component.html:26,46` |
| "Ultimas leituras" | `side-nav.component.ts:62` |
| "Conteudos sensiveis" | `user/filter/filter.component.html:29` |
| "Filtre os resultados que voce gostaria que aparesseesm ou nao na sua listegem de livros" | `user/filter/filter.component.html:4` |
| "Colecoes publicas", "Paginas salvas publicas", "Nenhuma colecao publica.", "Nenhuma pagina publica salva." | `public-user.component.html:28,30,47,49` |
| "Chaves de Acessos", "Dois fatores(2FA)" | `user/security/security.component.html:86,18` |

São os rótulos de navegação mais vistos da área logada.

**Reprodução:** abrir `/user/filter` e ler o subtítulo e o menu lateral.

**Correção:** revisar as strings (por exemplo, "Aparência", "Segurança", "Últimas leituras",
"Chaves de acesso", "Autenticação de dois fatores (2FA)").
**Critério de aceite:** `grep -rnE "Aparencia|Seguranca|Ultimas leituras|aparesseesm|Colecoes|Chaves de Acessos" src/app` → 0 resultados.

---

### U-02 · `app-select-cycle`: alternâncias só por mouse e sem nome — **Alta** (WCAG 2.1.1, 4.1.2)

`select-cycle.component.html:6-10` (usado em `books.component.html:14-18,40`)

```html
<div class="icon" [ngClass]="{ select: $index == select() }" (click)="onIconClick($event, $index)">
  <app-icons [name]="item.icon" />
</div>
```

Cada opção é uma `div` com `click`: não recebe foco, não responde a Enter ou Espaço, não tem papel
nem nome. Isso viola SC 2.1.1 [F2] e SC 4.1.2 [F3]. Em `/books`, essas alternâncias controlam o
modo de exibição (grade, lista, imagem) e o filtro de idioma e download. O ícone de globo, sozinho,
também não comunica o que filtra.

**Reprodução:** em `/books`, navegar com Tab: o foco salta as duas alternâncias.

**Correção:** `button type="button"` com `aria-label` e `aria-pressed` por opção, num container
`role="group"`. O `app-icon-button` com `aria-label` (`header.component.html:4,18`) é o
precedente.
**Critério de aceite:** um teste de componente que dispara `keydown.enter` na segunda opção e afirma
a mudança de `select()`, e `getByRole('button', { name: /lista/i })` encontra a opção.

---

### U-03 · Leitor: índice "1/15" é um `<a>` sem `href` que ocupa a largura toda — **Média** (WCAG 2.1.1)

`chapters.component.html:15-18,181` + `chapters.component.scss:11-20`

```html
<a class="index" (click)="backPage()" aria-label="Ir para a página do livro">
```

Sem `href`, o elemento não entra na ordem de foco. Visualmente, é uma barra laranja de 1040 px com
texto de 2,2 rem que não parece um link. É o elemento mais forte do topo do leitor e leva para fora
dele.

**Reprodução:** abrir um capítulo e tentar alcançar "1/15" com Tab.

**Correção:** `routerLink` para a página do livro (dá `href` e foco de graça) e um peso visual de
navegação secundária.
**Critério de aceite:** `document.querySelector('.index').getAttribute('href')` não é nulo, e o
elemento aparece na sequência de Tab.

---

### U-04 · Raiz de 12 px no celular e 34 regras ≤ 0,75 rem — **Média**

`global.scss:64-68` + `_mixins.scss:52-55`

```scss
@include mixins.mobile { html { font-size: 12px; } }   // mobile = max-width: 768px
```

Abaixo de 768 px, todo `rem` encolhe 25 %. Há 34 regras com `font-size` ≤ 0,75 rem ou ≤ 11 px
(`grep -rnE "font-size: *0\.(5|6|65|67|7)[0-9]*rem|font-size: *(9|10|11)px" --include='*.scss' src/app | wc -l`),
que viram 9 px ou menos. Exemplos: `library.component.scss:156` (0,65 rem → 7,8 px),
`login.component.scss:129,239` e `security.component.scss:125` (0,7 rem → 8,4 px). No desktop, o
autor do livro já sai com 10,72 px: o `h6` de `book.component.html:92-94` não tem `font-size`
(`book.component.scss:422`) e herda o padrão do navegador.

**Reprodução:** DevTools com largura de 390 px em `/library` e `/auth/login` e medir os textos
auxiliares. **Não executado nesta sessão.**

**Correção:** remover a redução global e ajustar os poucos blocos que precisam ser mais densos.
Definir um piso de 0,75 rem para textos auxiliares.
**Critério de aceite:** `grep -n "font-size: 12px" public/assets/scss/global.scss` → 0 resultados,
e nenhum texto computado < 12 px em 390 px nas rotas citadas.

---

### U-05 · Status interno de *scraping* exibido a todo leitor — **Média**

`info-book.component.html:187-205`

```html
@if (chapter.scrapingStatus) {
  <div class="scraping-status" [class.scrapingStatusReady]="…">
    {{ chapter.scrapingStatus | scrapingStatus }}
```

Cada linha de capítulo mostra um selo ("Pronto", em verde) do estado do *pipeline* de coleta. É
informação operacional, sem proteção de permissão, e duplica a sinalização da linha. O mesmo
template já protege a ação vizinha com `*appHasPermission="'books:download'"` (`:178`).

**Reprodução:** sem login, abrir `/books/227c6d65-4215-4924-9edf-a76005531d4d`: os 15 capítulos
exibem "Pronto".

**Correção:** envolver o bloco em `*appHasPermission` com uma permissão `internal:*`, como em
`:178`. Para leitores, mostrar só estados acionáveis (por exemplo, "indisponível").
**Critério de aceite:** em sessão anônima, `document.querySelectorAll('.scraping-status').length === 0`.

---

### U-06 · Gráficos do dashboard sem legenda e com rótulo só no *hover* — **Média**

`home.component.ts:95-125,133-162`

```ts
label: { show: false, position: 'center' },
emphasis: { label: { show: true, fontSize: '20' } },
```

```bash
grep -c "legend" src/app/pages/dashboard/home/home.component.ts
# → 0
```

As duas roscas de "Status de Scraping" não dizem o que cada cor significa sem passar o mouse. Isso
não funciona em toque nem para quem não consegue apontar. O eixo X das barras gira 45°
(`:184,222`) com texto `#aaa`.

**Reprodução:** abrir `/dashboard/home` e tentar identificar a fatia verde da rosca de capítulos
sem o mouse.

**Correção:** adicionar `legend` ao *option* da série *pie* [F4] e manter um rótulo com valor ou
porcentagem visível.
**Critério de aceite:** o *option* de ambas as roscas tem `legend`, e o teste de componente afirma
`option.legend` definido.

---

### U-07 · Configurações duplicadas e controles com semântica errada — **Baixa**

- **Separador Decimal aparece duas vezes** e grava o mesmo valor: `appearance.component.html:84-99`
  e `reader-settings-form.component.html:222-236`. Ambos chamam `setDecimalSeparator`
  (`appearance.component.ts:115`, `reader-settings-form.component.ts:120`), com o *handler*
  copiado.
- **A busca das configurações usa ícone de cadeado:** `leftIcon="lock"`
  (`user/outlet/outlet.component.html:70-71`). O cadeado já identifica "Segurança" no mesmo menu
  (`:45`).
- **"Sair" aparece duas vezes:** no menu lateral (`outlet.component.html:54`) e no fim do Perfil
  (`profile.component.html:69`), ao lado de "Salvar Alterações".

**Reprodução:** em `/user/all`, buscar "Separador" (duas linhas) e comparar o ícone da busca com o
do item "Segurança".

**Correção:** manter o separador num só lugar (Aparência) e linkar a ele a partir do leitor; usar
`leftIcon="search"`; tirar "Sair" do Perfil.
**Critério de aceite:** `grep -rn "Separador Decimal" src/app --include='*.html'` → 1 resultado;
`grep -n 'leftIcon="lock"' src/app/pages/user/outlet/outlet.component.html` → 0 resultados.

---

### U-08 · Estados vazios: um padrão por tela — **Baixa**

| Tela | Tratamento | Onde |
|---|---|---|
| Grades de livros | ícone + texto | `book-grid.component.html:30-32` |
| `/latest-reads` | ícone + texto + ação "Explorar livros" | `latest-reads.component.html:70-73` |
| `/library` | só texto | `library.component.html:38,44` |
| Perfil público | só texto | `public-user.component.html:30,49` |
| Dashboard — processamento e fila | só o título, nada abaixo | `dashboard/home/home.component.html:110,142` |

O padrão mais completo, o de `/latest-reads`, é o que menos se repete.

**Reprodução:** com a conta nova, abrir `/library` e `/latest-reads` lado a lado.

**Correção:** extrair um `app-empty-state` (ícone, mensagem, ação opcional) a partir de
`latest-reads.component.html:70-73` e usar nas cinco telas.
**Critério de aceite:** `grep -rln "app-empty-state" src/app --include='*.html' | wc -l` ≥ 5.

---

### U-09 · Detalhes pontuais — **Baixa**

| Item | Onde | Observação |
|---|---|---|
| Pontos do carrossel 10 × 10 px | `home.component.scss:281-283` | A distância entre centros (~22 px) é menor que o círculo de 24 px da exceção de espaçamento: falha SC 2.5.8 [F1]. |
| "Nenhuma descrição fornecida." em destaque | `home.component.html:57` | O *fallback* ocupa a posição de maior hierarquia do carrossel; esconder a linha seria mais limpo. |
| IP e método crus na sessão | `security.component.html:72` | Exibe `::ffff:172.18.0.1 · password` (IPv6 mapeado e termo em inglês). |
| Ano fixo no rodapé | `auth/outlet/outlet.component.html:42` | "© 2025" literal, com a data atual em 2026. |

**Reprodução:** abrir `/home`, `/user/security` e `/auth/login` e observar cada item da tabela.

**Correção:** pontos com área clicável ≥ 24 px; `@if (book.description)`; formatar o IP e traduzir
o método; ano por `new Date().getFullYear()`.
**Critério de aceite:** `grep -n "© 2025" src/app/pages/auth/outlet/outlet.component.html` → 0
resultados, e a caixa clicável de cada ponto do carrossel mede ≥ 24 × 24 px no DevTools.

---

### U-10 · Dados duplicados entre idiomas aparecem como opções distintas — **Média** (dados, não código)

Na lista de tags de `/user/filter` aparecem pares como Action/Ação, Adaptation/Adaptação,
Comedy/Comédia, Fantasy/Fantasia, Historical/Histórico, Incest/Incesto, Magic/Magia,
Military/Militar, Monsters/Monstros, Reincarnation/Reencarnação e Raio X/Raio-X. No gráfico
"Distribuição de Conteúdo Sensível", aparecem `suggestive` e `sugestivo` como barras separadas.
Medido no backend de dev em 2026-10-13; a produção não foi vista.

O filtro de tags fica com o dobro de opções, e as métricas do dashboard se dividem.

**Reprodução:** em `/user/filter`, rolar a lista de Tags e procurar os pares da lista acima.

**Correção:** usar a ação "Mesclar" que já existe em `/dashboard/tags` e `/dashboard/sensitive-content`.
**Critério de aceite:** a lista de `/user/filter` não contém nenhum dos pares listados.

---

### Q-01 · `hasPermission` compara objeto com string — **Média**

`user.service.ts:54` + `user.models.ts:45-48,57`

```ts
if (profile.roles.includes(Role.ADMIN)) return true;   // Role.ADMIN = 'admin'
```

O tipo declara `roles: Role[]` (*enum* de string), mas `/users/me` devolve objetos
(`{ id, name, maxWeightSensitiveContent }`, resposta medida nesta sessão). O atalho de admin
**nunca** é verdadeiro. Hoje os admins passam pela lista `permissions`, então o código é morto, e o
tipo mente sobre o formato da API.

**Reprodução:** logar como admin, abrir o console do navegador e verificar que
`profile.roles.includes('admin')` retorna `false`. **Lido no código; a chamada direta não foi executada.**

**Correção:** tipar `roles` como o objeto real e comparar por `name`, ou remover o atalho.
**Critério de aceite:** teste de `UserService.hasPermission` com perfil
`{ roles: [{ name: 'admin' }], permissions: [] }` afirma `true` (ou o atalho deixa de existir).

---

### Q-02 · Recarregar `/dashboard` redireciona para `/home` — **Média** (causa não identificada)

`app.routes.ts` (rota `dashboard` com `networkGuard` + `permissionGuard`) + `permission.guard.ts:20-33`

Com a conta admin, um `page.goto('/dashboard')` terminou em `/home`. Na mesma navegação, `/users/me`
respondeu 200 com 90 permissões, entre elas `internal:books:dashboard:view` (medido). A navegação
interna, pelo item "Dashboard" do side-nav, abre `/dashboard/home` normalmente.

A hipótese de perfil antigo em cache foi refutada: `_profile` nasce `null` a cada carga
(`user.service.ts:15`). Sobram duas ordens possíveis: o `networkGuard` ou a resolução assíncrona do
token antes do `fetchMe`.

**Reprodução:** com sessão admin válida, acessar `http://localhost:4200/dashboard` pela barra de
endereço.

**Correção:** instrumentar os dois guards (log da decisão e de `hasValidAccessTokenSignal()`) antes
de mudar código.
**Critério de aceite:** um *reload* em `/dashboard/home` com sessão admin permanece na rota.

---

## 6. O que está bem feito

| Lugar | Decisão |
|---|---|
| `_color-definitions.scss:3,68,133,194,241` | Cinco temas completos com os mesmos tokens semânticos, inclusive *badges* por categoria. |
| `/auth/login` e `/auth/register` | As telas mais coesas: hierarquia clara, passos visíveis, *passkey* como alternativa e regras de senha com estado (`text-input.component.html:60-61`). |
| `header.component.html:4,18` | Botões só com ícone têm `aria-label`, o modelo para U-02. |
| `side-nav.component.ts` (grupos) | Itens condicionados a login e admin no próprio menu, sem rotas mortas visíveis. |
| `info-book.component.html:178` | `*appHasPermission` no template, o padrão a estender em U-05. |

---

## 7. Backlog priorizado

> Ordenado por (impacto no usuário × alcance) ÷ esforço.

| Pri | Item | Esforço | Alcance | Tipo |
|---|---|---|---|---|
| 1 | **U-01** — revisar textos e acentos | XS | Área logada | UX |
| 2 | **U-02** — `app-select-cycle` acessível | S | `/books` | A11y |
| 3 | **V-01** — fonte de corpo global, Inknut só em títulos | M | Todas | UX |
| 4 | **U-05** — esconder status de *scraping* de leitores | XS | `/books/:id` | UX |
| 5 | **V-04** — tokens no monitoramento e nos gráficos | S | Dashboard | Qualidade |
| 6 | **U-04** — remover raiz de 12 px no celular | S | Celular | A11y |
| 7 | **U-03** — índice do leitor como `routerLink` | XS | Leitor | A11y |
| 8 | **U-06** — legenda nas roscas | XS | Dashboard | UX |
| 9 | **V-03 + V-05** — tokens de raio e título de página (mesma passada de estilo) | M | Todas | Qualidade |
| 10 | **U-07 + U-08** — configurações duplicadas e estado vazio único | S | `/user/*`, vazios | UX |
| 11 | **Q-01 + Q-02** — permissões: tipo de `roles` e *reload* do dashboard | S | Admins | Correção |
| 12 | **V-02** — decisão sobre o Aurora | L | Todas | Arquitetura |
| 13 | **V-06**, **U-09**, **U-10** — limpezas pontuais e dados | XS | Pontual | Correção |

V-03 e V-05 são uma unidade porque ambos pedem a mesma camada de tokens estruturais. Fazer um sem
o outro deixa a migração pela metade. Os itens 1, 4, 7 e 8 somam menos de meio dia e removem os
problemas mais visíveis para quem lê e para quem administra.

---

## 8. Riscos e o que falta verificar

1. **Nada foi visto fora do desktop escuro.** Antes de aceitar U-04 e V-04, abrir as rotas a
   390 px e no tema `light`, medindo contraste com DevTools.
2. **Monitoramento sem números nos cards — não verificado.** A captura mostrou só os rótulos, mas
   o template renderiza `aggregateCounts()` (`monitoring.component.html:28,44`). Confirmar no
   navegador se o valor some (dado ausente) ou se foi a captura que o perdeu.
3. **Erros de console sem diagnóstico.** Os 91 erros da seção 3.4 podem esconder falhas de
   carregamento que afetam telas aqui descritas. Abrir cada rota isolada e classificar os erros.
4. **Q-02 tem causa desconhecida.** Investigar antes de corrigir; a correção às cegas pode
   mascarar um defeito de token.
5. **Hipótese refutada: regras de senha "todas com ícone de check".** A captura sugeria isso, mas regras não
   cumpridas usam o ícone `close` (`text-input.component.html:61`). Fica registrado para não ser
   levantado de novo.
6. **Hipótese refutada: avatar do perfil público sem fundo.** Existe fundo
   `rgb(from var(--primary-color) r g b / 0.22)` (`public-user.component.scss:36`). A ferramenta
   de captura não serializa cores relativas.
7. **Hipótese refutada: guard usando perfil antigo em cache** (ver Q-02).
8. **U-10 depende do banco de dev.** A duplicidade pode não existir em produção.

---

## 9. Fontes consultadas

| # | Fonte | Tipo | Versão | Consultada em | Sustenta |
|---|---|---|---|---|---|
| F1 | [WCAG 2.2 — Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Doc oficial | 2.2 | 2026-10-13 | 2.3, U-09 |
| F2 | [WCAG 2.2 — Understanding SC 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) | Doc oficial | 2.2 | 2026-10-13 | 2.3, U-02, U-03 |
| F3 | [WCAG 2.2 — Understanding SC 4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) | Doc oficial | 2.2 | 2026-10-13 | 2.3, U-02 |
| F4 | [ECharts Handbook — eventos (exemplo de *pie* com `legend`)](https://github.com/apache/echarts-handbook/blob/master/contents/en/concepts/event.md) | Exemplo do mantenedor | 6.x (instalado 6.1.0) | 2026-10-13 | U-06 |
| F5 | [ECharts Handbook — guia de upgrade para a v6 (paleta padrão da v5)](https://github.com/apache/echarts-handbook/blob/master/contents/en/basics/release-note/v6-upgrade-guide.md) | Doc oficial | 6.x (instalado 6.1.0) | 2026-10-13 | V-04 |

F4 e F5 foram consultadas via Context7 (`/apache/echarts-handbook`). A página de referência de
opções (`echarts.apache.org/en/option.html`) não renderizou pelo *fetch*. Por isso, o
comportamento padrão de `legend` quando omitido não foi lido na doc de referência: U-06 se apoia
na ausência medida no código e no exemplo do mantenedor.

---

> Nenhum item deste relatório foi visto em produção, em dispositivo móvel ou nos temas claros. As
> observações vêm de um dev server local com o backend de dev em Docker, Chromium a 1440 × 900 no
> tema escuro e n = 1 por tela. Os dados exibidos são do banco local. Nenhuma correção foi
> implementada: o relatório é só diagnóstico.
