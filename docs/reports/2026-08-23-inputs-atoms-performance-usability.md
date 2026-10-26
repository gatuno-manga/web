# Análise Técnica — `src/app/shared/ui/atoms/inputs`

**Data:** 2026-08-23 · **Branch:** `developer` · **Commit base:** `912fc3d`
**Escopo:** os 10 átomos de entrada (`autocomplete-input`, `button`, `checkbox`, `list-checkbox`,
`list-switch`, `mfa-input`, `select`, `switch`, `text-area`, `text-input`) — 2.708 linhas em 38 ficheiros.
**Relatórios irmãos:** [`chapters`](./2026-08-23-chapters-performance-usability.md) ·
[`readers`](./2026-08-23-readers-performance-usability.md) ·
[`book-grid`](./2026-08-23-book-grid-context-menu-item-book-performance-usability.md)

---

## 1. Sumário executivo

Esta pasta é a **base de toda a interação de formulário da aplicação**: 67 pontos de uso em
templates. Ao contrário dos relatórios anteriores — que analisaram um ecrã — aqui cada defeito é
multiplicado pelo número de consumidores. Um erro no `switch` não afeta uma página: afeta seis.

O diagnóstico central não é "os componentes estão lentos". É que **não existe um padrão**. Há três
implementações diferentes de checkbox na mesma pasta, duas convenções incompatíveis para esconder
um `<input>` nativo, dois componentes que declaram `setDisabledState` e não o implementam, e um
componente sem uma única linha de CSS. O custo real desta pasta é de consistência e de acesso, não
de milissegundos.

### Os cinco problemas que dominam o resultado

| # | Problema | Alcance | Severidade |
|---|---|---|---|
| U-01 | `switch` usa `input { display: none }` — o controlo é **inalcançável por teclado e invisível para leitores de ecrã** | 6 usos | **Crítica** |
| U-02 | `checkbox.component.scss` tem **0 bytes** — o componente renderiza a checkbox nativa crua | 2 usos | **Crítica** |
| U-03 | Mensagens de erro **não têm cor, não têm `role`, não têm `aria-describedby`** — o erro é indistinguível de texto normal | 16 usos de `app-input` | **Alta** |
| U-04 | `select` abre mas **não é navegável por teclado** — sem setas, sem `aria-activedescendant`, opções sem `tabindex` | 9 usos | **Alta** |
| P-01 | `transition: all` combinado com `margin-top` e `height` animados — **cada focus reflui o formulário inteiro durante 300 ms** | 19 usos | **Alta** |

Adicionalmente, o `mfa-input` **não repinta quando o formulário escreve nele** (`writeValue` muta um
array simples sob `OnPush` numa aplicação *zoneless*), e dois componentes inteiros
(`autocomplete-input`, `list-switch`, 217 linhas) estão mortos — confirmado por ausência no bundle
de produção medido na secção 3.

**Veredicto:** a camada de átomos foi construída incrementalmente, componente a componente, sem um
contrato partilhado. O trabalho de maior retorno não é otimizar — é **unificar**: um único padrão de
foco, um único padrão de erro, um único padrão de `<input>` visualmente escondido, aplicado aos dez.

---

## 2. Metodologia e limites

### 2.1 O que foi feito

- **Leitura integral** dos 38 ficheiros da pasta (`.ts`, `.html`, `.scss`, `.spec.ts`).
- **Rastreio dos consumidores**: `grep` sobre todos os `*.html` de `src/` para contar usos reais e
  ler os padrões de integração (secção 6).
- **Build de produção real** executado nesta análise (`npx ng build --configuration production`,
  exit 0, 6,602 s) — os números da secção 3 são **medidos** no output de `dist/front/browser`.
- **Verificação dos tokens de tema** contra `public/assets/scss/_color-definitions.scss` e
  `_color.scss` (5 temas: `dark`, `true-dark`, `light`, `dracula`, `slate`).
- **Inspeção do CSS compilado** para confirmar as regras que chegam efetivamente ao browser
  (nomeadamente o `switch`, secção 5.3).

### 2.2 O que NÃO foi feito — limites desta análise

> **Não houve profiling em runtime nem auditoria automatizada de acessibilidade.** Não foi executado
> Lighthouse, axe-core, nem teste com leitor de ecrã real (NVDA/VoiceOver). As falhas de WCAG
> apontadas na secção 5 são derivadas de **análise estática do DOM produzido** e são de tipo
> determinístico (ausência de atributo, `display:none` em elemento focável, alvo abaixo de 24 px) —
> não dependem de medição. As afirmações de custo de *layout* na secção 4 estão marcadas como
> `[modelado]` e derivam das propriedades animadas declaradas no CSS, não de traces de frame.
> Antes de aceitar qualquer correção de performance, os valores devem ser confirmados com medição.

### 2.3 Contexto de execução relevante

| Facto | Valor | Onde |
|---|---|---|
| Angular | 21.0.1 | `package.json` |
| CDK | 21.1.0 | `package.json` |
| Deteção de alterações | **`provideZonelessChangeDetection()`** | `src/app/app.config.ts:34` |
| Estratégia dos 10 átomos | `OnPush` em todos | verificado ficheiro a ficheiro |
| Temas ativos | 5 (incl. **light**) | `_color-definitions.scss:3,70,137,200,249` |
| Folha global | `public/assets/scss/global.scss` (33,78 kB, 3,79 kB transfer) | `angular.json` + build |

O modo *zoneless* é determinante para dois achados: torna obrigatório que qualquer mutação de estado
fora de um *listener* de template seja feita em `signal` (ver U-06, `mfa-input`), e torna os métodos
chamados a partir do template mais caros por ciclo, já que não há amortização de *zone*.

### 2.4 Inventário e alcance por componente

| Componente | Linhas | Usos em `src/` | No bundle de produção? | CVA |
|---|---:|---:|---|---|
| `button` | 197 | **28** | ✅ `chunk-TV3PWAFA.js` | — |
| `text-input` (+ `PasswordInput`) | 458 | **16** | ✅ `chunk-T4CBEQDQ.js` | ✅ |
| `select` | 842 | **9** | ✅ `chunk-CBYYNZHI.js` | ✅ |
| `switch` | 105 | **6** | ✅ `chunk-P6G4VJBM.js` | ✅ |
| `text-area` | 343 | **3** | ✅ `chunk-TFZ2MKU5.js` | ✅ |
| `checkbox` | 88 | **2** | ✅ `chunk-IJWPDYQA.js` | ✅ |
| `list-checkbox` | 125 | **2** | ✅ `chunk-I4EJA3MM.js` | ❌ |
| `mfa-input` | 153 | **1** | ✅ `chunk-CIFAGIKW.js` | ✅ |
| `autocomplete-input` | 259 | **0** | ❌ **ausente** | ✅ |
| `list-switch` | 62 | **0** | ❌ **ausente** | ❌ |

---

## 3. Evidências medidas (build de produção, 2026-08-23)

### 3.1 Orçamento inicial

```
Initial chunk files  | Names   |  Raw size | Estimated transfer size
chunk-J7M3M2YR.js    | -       | 203.60 kB |                60.29 kB
chunk-W2NV6RSN.js    | -       |  80.82 kB |                20.03 kB
chunk-M7DU5YNT.js    | -       |  54.62 kB |                15.20 kB
main-URM6G76M.js     | main    |  37.14 kB |                 9.33 kB
styles-XVNKJDVO.css  | styles  |  33.78 kB |                 3.79 kB
```

Build limpo, exit 0, sem violações de orçamento (`initial` warning a 750 kB, `anyComponentStyle`
warning a 20 kB). **Nenhum átomo de input viola o teto de 20 kB de estilo por componente** — o maior
é o `select`, medido abaixo.

### 3.2 Código morto confirmado, não estimado

Procura pelas assinaturas CSS de cada componente em todos os `.js` emitidos:

| Componente | Marcador procurado | Resultado |
|---|---|---|
| `autocomplete-input` | `.autocomplete-dropdown` | **NÃO ENCONTRADO** em nenhum chunk |
| `list-switch` | `.itens` | **NÃO ENCONTRADO** em nenhum chunk |

Ambos foram eliminados por *tree-shaking*. Isto **confirma** a contagem de 0 usos e significa que o
custo destes componentes é **zero em runtime** — o problema é exclusivamente de manutenção: 217
linhas que um programador vai ler, copiar e propagar defeitos (o `setTimeout` de 200 ms do
autocomplete é exatamente o tipo de padrão que se propaga por cópia).

### 3.3 Peso de estilo por componente (CSS compilado, medido)

| Componente | SCSS fonte | CSS compilado no bundle |
|---|---:|---:|
| `select` | 423 linhas | **6.168 bytes** |
| `button` | 110 linhas | **1.376 bytes** |
| `text-area` | 134 linhas | 617 bytes (bloco parcial extraído) |
| `checkbox` | **0 linhas** | **0 bytes** |

O `select` sozinho é 6,1 kB de CSS — mais do que os outros nove somados. A secção 4.5 mostra que uma
fração mensurável desse peso é código morto herdado da implementação anterior ao CDK Overlay.

### 3.4 Verificação negativa: estilos NÃO estão duplicados

`TextInputComponent` e `PasswordInputComponent` partilham `templateUrl` e `styleUrl`
(`text-input.component.ts:33-34` e `202-203`). A hipótese inicial era que o compilador emitisse a
folha duas vezes, uma por `_ngcontent` slug.

**Medição:** a regra `.input{position:relative;padding:0 .75rem` aparece **1 vez** em
`chunk-T4CBEQDQ.js`. O compilador iça a string partilhada para uma variável reutilizada pelos dois
`ɵcmp`. **Não há duplicação** — a hipótese está refutada e é registada aqui para não voltar a ser
levantada.

---

## 4. Achados de performance

### P-01 · `transition: all` a animar `margin-top`, `top` e `height` — **Alta**

**Onde:** `text-input.component.scss:11,13-15,38,44-53,109-114` · `text-area.component.scss` (mesmo
padrão) · `autocomplete-input.component.scss:17`

Três animações de layout empilhadas no mesmo componente, todas declaradas com a propriedade `all`:

```scss
.input {
	transition: all 0.3s ease-in-out;   // :11  — 'all'

	&.label { margin-top: 1.5rem; }     // :13-15 — MARGIN animada
}

label {
	transition: all 0.3s ease-in-out;   // :38  — 'all'
	top: 50%;                            // :39
}
label.ative {
	top: -2.5rem;                        // :46  — TOP animado
}

.error-messages {
	height: calc(var(--error-count) * 1.6rem);  // :113 — HEIGHT animada
	transition: 0.3s;                            // :114 — 'all' implícito
}
```

**Porque é um problema.** `margin-top`, `top` (em elemento posicionado) e `height` são propriedades
que disparam **layout** (reflow), não apenas *paint* ou *composite*. O browser não as pode passar
para a thread de composição. Consequência concreta:

- Ao focar um campo, `.input` ganha `margin-top: 1.5rem`. Como está animado, o browser recalcula o
  layout **a cada frame durante 300 ms** — e como `margin-top` empurra o elemento, **todo o conteúdo
  abaixo no formulário desloca-se durante a animação**. Num formulário de registo com 3 campos
  (`register.component.html`), focar o terceiro campo reflui os dois de cima mais o botão.
- A mesma coisa acontece ao aparecer/desaparecer um erro: `height` transiciona de `0` para `1.6rem`,
  refluindo tudo o que está abaixo.
- `transition: all` é pior do que uma lista explícita porque obriga o browser a **considerar todas
  as propriedades animáveis** no cálculo da transição, incluindo as que herdam de mudanças de tema
  (`background-color`, `border-radius`) que não se pretendia animar.

`[modelado]` A ~60 fps, 300 ms = **~18 passagens de layout** por evento de foco, sobre a subárvore do
formulário. Não é catastrófico num desktop; num Android médio com 4× de throttling de CPU, é
exatamente o tipo de trabalho que consome o orçamento de INP no momento em que o utilizador toca no
campo — ou seja, no pior momento possível.

**Correção.** O padrão de *floating label* deve animar `transform`, nunca `top`, e o espaço do label
deve ser **reservado permanentemente** com `padding-top` em vez de conquistado com `margin-top`:

```scss
.input {
	transition: box-shadow .2s ease, outline-color .2s ease;  // lista explícita, só compositing
	padding-top: 1.5rem;   // espaço sempre reservado — nunca reflui
}
label {
	transition: transform .2s ease, font-size .2s ease, color .2s ease;
	transform: translateY(0);
}
label.ative { transform: translateY(-1.6rem) scale(.85); }
```

Para o bloco de erros, substituir a animação de `height` por `grid-template-rows: 0fr → 1fr` (ainda
layout, mas confinado ao contentor de grid) ou simplesmente reservar uma linha fixa e animar
`opacity` + `transform` — o que também resolve o CLS de o formulário "saltar" quando o erro aparece.

---

### P-02 · `errorMessages()` é um método chamado **duas vezes por ciclo** de deteção — **Média**

**Onde:** `text-input.component.ts:151-188` invocado em `text-input.component.html:69` e `:70`
(idem `text-area.component.ts:117-154` / `.html:49-50`)

```html
<div class="error-messages" [style.--error-count]="errorMessages().length">   <!-- 1ª chamada -->
  @for (item of errorMessages(); track $index) {                              <!-- 2ª chamada -->
```

O método não é um `computed()`. Cada invocação executa `Object.keys()`, um `.map()` com um `for...in`
aninhado e um `.filter()` — **três alocações de array por chamada**, seis por ciclo de deteção,
por instância.

Com 16 instâncias de `app-input` na aplicação e formulários que revalidam a cada tecla, isto é
trabalho puramente redundante: o resultado só muda quando `errors()`, `touched()` ou
`firstLostFocus` mudam.

Agrava-se do lado do consumidor, onde o mesmo padrão se repete (9 ocorrências):

```html
[errors]="this.form.get('email')?.errors"        <!-- register.component.html:19 -->
[touched]="this.form.get('email')?.touched ?? false"
```

`form.get()` é uma travessia de path com `split('.')` executada em cada ciclo de deteção do
componente pai, para cada campo.

**Correção.** `errorMessages` deve ser `computed()`. Mas a correção real é estrutural — ver secção 6:
o componente deveria injetar `NgControl` e derivar `errors`/`touched` sozinho, eliminando as 18
linhas de *binding* manual espalhadas pelos consumidores.

---

### P-03 · `select`: métodos por opção, sem virtualização — **Média**

**Onde:** `select.component.ts:162-169` (`iconSize`), `:171-173` (`isSelected`),
`select.component.html:87-124`

```html
@for (option of filteredOptions(); track option.value) {
  [class.selected]="isSelected(option)"          <!-- método, 1× por opção -->
  [attr.aria-selected]="isSelected(option)"      <!-- método, 2× por opção -->
  [size]="iconSize()"                            <!-- método, +1× se tiver ícone -->
```

`filteredOptions()` **é** um `computed` (bem feito, `:90-96`), mas `isSelected` e `iconSize` são
métodos normais reavaliados por opção em cada ciclo.

`[modelado]` Com 200 opções: **~600 invocações de método por ciclo de deteção**, cada uma com uma
conversão `String(option.value)`. Além disso não há `cdk-virtual-scroll-viewport`: as 200 opções são
todas instanciadas no DOM, e cada opção com `icon` instancia um `IconsComponent` completo — que traz
um pipeline `toObservable` → `switchMap` → `toSignal` e um `[innerHTML]` com
`bypassSecurityTrustHtml` (`icons.component.ts:35-40`, `icons.component.html:1`).

`isSelected` é trivialmente substituível por um `computed` do valor selecionado comparado no
template; `iconSize` deve ser `computed` (depende só de `size()`); e listas acima de ~50 opções
justificam `CdkVirtualScrollViewport` dentro do overlay.

---

### P-04 · `backdrop-filter` em dropdowns animados — **Média**

**Onde:** `select.component.scss:188` (`@include glass-dropdown`) e
`autocomplete-input.component.scss` (mesmo include) → `_mixins.scss:77-79` →
`glass-backdrop(8px, 160%)`

`backdrop-filter: blur(8px) saturate(160%)` obriga o compositor a:
1. promover o elemento a uma camada própria;
2. **ler de volta o conteúdo pintado por baixo** a cada frame;
3. aplicar um blur gaussiano de raio 8 sobre essa leitura.

O agravante é que o dropdown **anima ao abrir** (`selectSlideDown`, `:190`, 200 ms de `opacity` +
`transform`). Durante esses 200 ms o backdrop está a ser re-lido e re-desfocado a cada frame, sobre
uma superfície até `320px × 90vw`. Em GPUs móveis, `backdrop-filter` sobre superfície grande em
movimento é dos efeitos mais caros disponíveis em CSS.

**Correção pragmática:** manter o vidro (é identidade visual do produto) mas **desligá-lo durante a
animação** — aplicar o `backdrop-filter` só no estado final via `animation-fill-mode`, ou fazer
*fade* apenas de `opacity` sem `transform`, ou degradar para `background: color-mix(...)` opaco em
`@media (max-width: 768px)`. Confirmar antes com trace real.

---

### P-05 · CSS morto no `select` — **Baixa**

**Onde:** `select.component.scss:10-12`, `:51-57`, `:221-228`, `:363`

O componente foi migrado para `cdkConnectedOverlay` (`select.component.html:63-70`) mas o CSS da
implementação anterior ficou:

- `:host(.select-open) { z-index: 99 !important; }` — o dropdown já não é filho do host; o overlay
  vive no `cdk-overlay-container`. O `!important` não faz nada e é *ruído* que convida a novos
  `!important` por cima.
- `.custom-select.is-open { z-index: 99; .select-trigger { z-index: 99; } }` — idem.
- `.select-dropdown.drop-top { top: auto; bottom: 100%; ... }` — o posicionamento é agora feito pelo
  `ConnectionPositionPair` (`select.component.ts:75-88`); a classe `drop-top` **nunca é aplicada** no
  template.
- `// Removed manual overlay` (`:363`) — comentário-lápide.

Existe ainda um `input` `dropdownPosition` (`select.component.ts:64`) declarado e **nunca lido** — a
posição real vem sempre do array `positions` fixo.

Nota relacionada: `.select-trigger:hover:not(.disabled)` (`:77`) — a classe `disabled` está no
`.custom-select` pai (`select.component.html:3`), nunca no trigger. O guarda `:not()` é inerte; o
efeito desejado só funciona por acidente, via `pointer-events: none` no pai (`:48`).

---

### P-06 · Constante de ícones eager no bundle inicial — **Baixa** (fora de escopo, registado)

`IconRegistryService` é `providedIn: 'root'` e importa estaticamente `APP_ICONS`
(`icon-registry.service.ts:3`), um objeto de **32.565 bytes** de SVG inline. Todos os ícones da
aplicação são carregados independentemente de serem usados.

Não é um defeito *desta* pasta, mas cada um dos 10 átomos depende de `IconsComponent`, pelo que fica
registado: um `IconRegistryService` com carregamento sob demanda (ou sprite SVG externo com
`<use href="#id">`) removeria ~32 kB do caminho crítico e eliminaria o `[innerHTML]` + sanitizador
por instância de ícone.

---

## 5. Achados de usabilidade e acessibilidade

### U-01 · `switch` é inalcançável por teclado e invisível para leitores de ecrã — **Crítica**

**Onde:** `switch.component.scss:33-34`

```scss
input {
	display: none;
}
```

`display: none` remove o elemento **da árvore de acessibilidade e da ordem de tabulação**. Não é uma
técnica de esconder visualmente — é uma remoção total.

Consequências, verificadas no DOM produzido:
- O switch **não recebe foco com `Tab`**. Não existe nenhuma outra forma de o ativar sem rato.
- Um leitor de ecrã não anuncia nada: não há `checkbox`, não há `switch`, não há estado.
- O `<label class="switch-container">` envolve o input, mas um label não é focável nem operável.

**Falha WCAG 2.1.1 Keyboard (Nível A)** e **4.1.2 Name, Role, Value (Nível A)**. Seis usos em
produção.

O mais frustrante é que **a correção já existe nesta pasta**. `list-checkbox` usa o padrão certo:

```scss
/* list-checkbox.component.scss */
.custom-checkbox-label input[type='checkbox'] {
	position: absolute;
	opacity: 0;
	width: 0;
	height: 0;
}
```

Isto mantém o input focável e no *accessibility tree*. Há **duas convenções contraditórias para o
mesmo problema, na mesma pasta** — e a errada é a que está em 6 sítios.

**Correção.** Substituir por uma classe `.visually-hidden` partilhada, e adicionar
`role="switch"` + `[attr.aria-checked]` para que o controlo seja anunciado como *switch* e não como
*checkbox*. O `list-checkbox` também ganha em usar `clip-path: inset(50%)` com `width:1px;height:1px`
em vez de `width:0;height:0`, que alguns leitores de ecrã tratam como não renderizado.

---

### U-02 · `checkbox.component.scss` tem 0 bytes — **Crítica**

**Onde:** `src/app/shared/ui/atoms/inputs/checkbox/checkbox.component.scss` (**ficheiro vazio,
confirmado: `wc -c` = 0**)

O template declara um design que não existe:

```html
<label class="checkbox-container" [class.disabled]="disabled()">
	<input type="checkbox" [checked]="value()" ... />
	<span class="checkmark"></span>     <!-- span sem uma única regra CSS -->
	<ng-content></ng-content>
</label>
```

Procura por `.checkbox-container` e `.checkmark` em **todo o `src/` e em `public/assets/scss/`**:
nenhuma correspondência fora do `switch` (que tem o seu próprio `.checkmark`). Não há estilo global
a salvar isto — `src/styles.scss` é um *placeholder* de uma linha
(`/* styles placeholder for tests */`) e a folha real, `public/assets/scss/global.scss`, também não
contém nada.

**O CSS não se perdeu — nunca existiu.** Confirmado no histórico: o ficheiro foi criado com 0 bytes
no commit `56e17c0` (*migrate project architecture to FSD/DDD and Atomic Design*, 2026-05-06), e o
seu antecessor `src/app/components/inputs/checkbox/checkbox.component.scss`, antes da migração,
**também tinha 0 bytes**. O componente nunca chegou a ser desenhado.

**O que o utilizador vê:** a checkbox nativa do browser, sem tema, com a cor de acento do sistema
operativo — ao lado de `app-list-checkbox`, que na mesma aplicação renderiza uma checkbox
personalizada com `--primary-color` e um *checkmark* desenhado a `border`. **Dois desenhos
diferentes para o mesmo conceito**, dependendo de qual dos dois componentes o programador escolheu.

Acresce que `[indeterminate]="indeterminate()"` (`checkbox.component.html:6`) está corretamente
ligado — mas sem CSS não há qualquer representação visual do estado indeterminado além do traço
nativo do browser.

**Correção.** Isto é uma decisão de produto antes de ser técnica: ou `app-checkbox` recebe o desenho
do `list-checkbox` (e `list-checkbox` passa a compô-lo em vez de reimplementar), ou `app-checkbox` é
eliminado. **Manter os dois com desenhos diferentes não é uma opção defensável.**

---

### U-03 · Erros sem cor, sem semântica, sem anúncio — **Alta**

**Onde:** `text-input.component.scss:124-128`, `text-input.component.html:17-28,69-73` (idem
`text-area`)

```scss
.error-message {
	line-height: $line-height;
	font-size: 0.9rem;
	margin-left: 0.5rem;
	/* nenhuma declaração de color */
}
```

Verificação de tokens: `--error-color` **não existe** em `_color-definitions.scss`. Existe
`--danger-color` (`:36`), usado pelo medidor de força de palavra-passe (`:73`) — mas **não** pela
mensagem de erro. A mensagem herda a cor de texto do corpo.

**Resultado:** "Este campo é obrigatório" aparece na mesma cor que qualquer outro texto da página.
Não é um caso de "a cor é o único canal de informação" (que já falharia 1.4.1) — é a ausência
completa de qualquer canal visual que distinga erro de ajuda.

No lado semântico, o `<input>` gerado não tem:

| Atributo em falta | Consequência |
|---|---|
| `aria-invalid` | O leitor de ecrã não sabe que o campo está inválido |
| `aria-describedby` → id do erro | O erro nunca é lido ao focar o campo |
| `role="alert"` / `aria-live="polite"` no contentor | O erro que aparece dinamicamente nunca é anunciado |

**Falha WCAG 3.3.1 Error Identification (Nível A)** e **1.4.1 Use of Color (Nível A)**.

Há ainda um defeito lógico em `errorMessages()` (`text-input.component.ts:151-156`):

```ts
if (errorsValue && this.firstLostFocus && (this.touched() || this.firstLostFocus)) {
```

A terceira condição é redundante — `this.firstLostFocus` já foi exigida na segunda. Na prática, o
input `touched` recebido do formulário **é ignorado**: o erro só aparece depois de o utilizador ter
saído *deste* campo especificamente. Submeter o formulário com um campo nunca tocado marca o
controlo como `touched` no Angular, mas **este componente não mostra o erro**, porque
`firstLostFocus` continua `false`. O utilizador vê a submissão falhar sem saber porquê.

---

### U-04 · `select` abre mas não se pode escolher nada com o teclado — **Alta**

**Onde:** `select.component.html:6-20` (trigger) e `:88-96` (opções)

O trigger está bem: `role="combobox"`, `tabindex="0"`, `aria-haspopup`, `aria-expanded`,
`(keydown.enter)`, `(keydown.space)`, `(keydown.escape)`.

O que acontece a seguir é que **não acontece nada**:

```html
<div class="select-option"
     (click)="selectOption(option)"     <!-- só rato -->
     role="option"
     [attr.aria-selected]="isSelected(option)">
```

Não há `tabindex`, não há `(keydown)`, não há `aria-activedescendant` no combobox, não há
`aria-controls` a apontar para a lista, não há gestão de índice ativo. Um utilizador de teclado
abre o dropdown com `Enter` e fica preso: `Tab` sai do combobox e deixa o overlay aberto por trás;
as setas não fazem nada.

Em falta face ao padrão ARIA Combobox:

| Comportamento esperado | Estado |
|---|---|
| `ArrowDown` / `ArrowUp` movem a opção ativa | ❌ |
| `Home` / `End` saltam para a primeira/última | ❌ |
| `Enter` seleciona a opção ativa | ❌ |
| Escrita rápida faz *typeahead* | ❌ |
| `aria-activedescendant` no combobox | ❌ |
| Foco automático no campo de pesquisa quando `searchable()` | ❌ |
| Devolver o foco ao trigger ao fechar | ❌ |
| Rolar a opção ativa para a vista | ❌ |
| `aria-labelledby` a ligar o `.floating-label` ao combobox | ❌ |

**Falha WCAG 2.1.1 (Nível A)** e **4.1.2 (Nível A)**. Nove usos.

**Correção.** O CDK já está no projeto (`@angular/cdk@21.1.0`) e traz `ListKeyManager` /
`ActiveDescendantKeyManager` exatamente para isto — resolve setas, Home/End, typeahead e
`aria-activedescendant` com poucas linhas. Não é preciso escrever a máquina de estados à mão.

---

### U-05 · `mfa-input` não repinta quando o formulário escreve nele — **Alta**

**Onde:** `mfa-input.component.ts:31,39-48`

```ts
digits: string[] = ['', '', '', '', '', ''];   // array simples, não signal

writeValue(value: string): void {
	if (value && typeof value === 'string') {
		this.digits = value.split('').slice(0, 6);   // reatribuição silenciosa
		...
	}
}
```

O componente é `OnPush` (`:28`) numa aplicação `zoneless` (`app.config.ts:34`). `writeValue` é
chamado pelo Angular Forms **fora de qualquer listener de template** — em `patchValue`,
`setValue`, `reset`, ou no primeiro *binding* do controlo.

Como `digits` não é um `signal` e não há `ChangeDetectorRef.markForCheck()`, **a vista nunca é
marcada como suja**. As seis caixas continuam a mostrar o valor anterior.

Comparação direta: `SelectComponent` faz exatamente isto certo — `writeValue` escreve num signal
**e** chama `cdr.markForCheck()` (`select.component.ts:110-113`). Mais uma vez, o padrão correto
existe na pasta e não foi aplicado de forma consistente.

**Cenário de falha concreto:** ecrã de verificação MFA que preenche o código automaticamente a partir
de um deep-link ou que faz `form.reset()` após um código errado — o utilizador vê os dígitos antigos
e não percebe se o campo foi limpo.

**Outros defeitos no mesmo componente:**

| Problema | Linha | Impacto |
|---|---|---|
| Sem `autocomplete="one-time-code"` | `.html:3-13` | Desliga o autofill de SMS do iOS e Android — o principal atalho de UX num campo MFA |
| Sem `aria-label` por caixa | `.html:3-13` | Leitor de ecrã anuncia seis campos idênticos sem nome |
| `type="text"` sem filtragem | `.ts:58-78` | Aceita letras e símbolos; `pattern="[0-9]*"` só atua em validação nativa de `<form>`, que aqui não corre |
| Sem `setDisabledState` | — | `form.disable()` não desativa as caixas |
| `onKeyDown` só trata `Backspace` | `.ts:80-84` | Sem `ArrowLeft`/`ArrowRight` para corrigir um dígito no meio |
| Sem `aria-live` para o estado de conclusão | — | Nada anuncia que o código está completo |

---

### U-06 · `setDisabledState` declarado e vazio — o formulário desativa mas o campo continua editável — **Alta**

**Onde:** `text-area.component.ts:97` e `autocomplete-input.component.ts:99`

```ts
setDisabledState?(_isDisabled: boolean): void {}
```

Ambos implementam `ControlValueAccessor` e ambos declaram este método — **vazio**. O `?` opcional na
assinatura mascara o problema: o TypeScript aceita, o Angular chama, nada acontece.

`form.disable()` num formulário com um `app-text-area` deixa o `<textarea>` totalmente editável e
focável. O utilizador escreve num campo que o programador acredita estar bloqueado — durante uma
submissão em curso, por exemplo. O valor escrito é ignorado pelo formulário (o controlo desativado
não recolhe valor), pelo que o utilizador **perde o que escreveu sem qualquer aviso**.

`text-input`, `select`, `checkbox` e `switch` implementam isto corretamente com um signal
`isDisabled`. São 4 corretos contra 2 vazios — outro sintoma da ausência de contrato partilhado.

---

### U-07 · Alternador de palavra-passe: DOM imperativo, ícone invertido, não focável — **Alta**

**Onde:** `text-input.component.ts:206-254`, `text-input.component.html:38-44`

Três defeitos independentes no mesmo controlo.

**a) Duas fontes de verdade para `type`.** O template liga
`[type]="type() === 'password' ? passwordInputType : type()"` (`.html:20`) e simultaneamente
`togglePasswordVisibility()` escreve `inputEl.type = ...` diretamente no DOM (`.ts:242`). Duas
escritas concorrentes ao mesmo atributo; qualquer futura reconciliação do Angular sobrepõe a escrita
imperativa.

**b) O ícone contradiz o estado inicial.**

```ts
private _passwordRightIcon = 'eye';        // :208 — estado inicial: password ESCONDIDA
...
this._passwordRightIcon = this.showPassword ? 'eye' : 'eye-close';   // :243
```

| Momento | `showPassword` | Ícone mostrado |
|---|---|---|
| Inicial | `false` (escondida) | `eye` |
| Após 1º clique | `true` (visível) | `eye` |
| Após 2º clique | `false` (escondida) | `eye-close` |

O mesmo estado — password escondida — mostra dois ícones diferentes consoante o histórico de
cliques, e nos dois primeiros estados o ícone é literalmente o mesmo apesar de o estado ter mudado.
O único feedback fiável do primeiro clique é o texto do campo mudar.

**c) O alternador não é um botão.** É um `<app-icons>` com `(click)`:

```html
<app-icons [ngClass]="{ clickable: ... }" (click)="onRightIconClick($event)" />
```

Renderiza uma `<div class="icon-container">` (`icons.component.html:1`). Sem `tabindex`, sem
`role="button"`, sem `aria-label`, sem `aria-pressed`, sem ativação por `Enter`/`Space`. Um
utilizador de teclado **não consegue revelar a sua própria palavra-passe** — precisamente o
utilizador que mais beneficia dessa funcionalidade, porque não pode confirmar visualmente o que
escreveu.

O mesmo se aplica a `leftIconClick` / `rightIconClick` genéricos (`.ts:88-102`): qualquer consumidor
que passe uma dessas funções cria um controlo inacessível.

**Falha WCAG 2.1.1 (A)** e **4.1.2 (A)**.

---

### U-08 · Alvos de toque abaixo do mínimo — **Média**

**Falha WCAG 2.2 SC 2.5.8 Target Size (Minimum), Nível AA:** mínimo de **24 × 24 px CSS**.

| Controlo | Dimensão real | Origem | Estado |
|---|---|---|---|
| `switch` (pista) | **34 × 15 px** | `switch.component.scss:9-10` | ❌ falha por 9 px de altura |
| `checkbox` nativa | ~13 × 13 px | sem CSS (U-02) | ❌ falha por ~11 px |
| `select` tamanho `sm` | 36 px de altura | `select.component.scss:16` | ✅ AA · ❌ AAA (2.5.5, 44 px) |
| `text-input` | 42 px de altura | `text-input.component.scss:4` | ✅ AA · ❌ AAA por 2 px |
| `mfa-input` caixa | 40 × 56 px | `mfa-input.component.scss:9-10` | ✅ AA · ❌ AAA na largura |
| `list-checkbox` | 20 × 20 px, mas dentro de um `<label>` de largura total | `list-checkbox.component.scss:22-23` | ✅ (o label é o alvo) |

O `switch` é o caso crítico e o mais usado dos que falham. A correção não exige mudar o desenho:
basta um pseudo-elemento invisível a expandir a área de toque —
`&::after { content:''; position:absolute; inset:-12px; }` — mantendo os 15 px visuais.

O `list-checkbox` mostra o padrão certo: o alvo é o `<label>` de largura total, não o quadrado
desenhado.

---

### U-09 · Cores fixas quebram 4 dos 5 temas — **Média**

A aplicação tem 5 temas (`_color-definitions.scss`), incluindo **light** (`:137`). Estes componentes
ignoram o sistema de tokens:

| Ficheiro | Declaração | Efeito no tema `light` |
|---|---|---|
| `autocomplete-input.component.scss` | `color: var(--white)` no `input` e `.option-label` | `--white: #fdfdfd` (`_color.scss:15`) — texto quase branco sobre fundo claro: **ilegível** |
| `autocomplete-input.component.scss` | `.option-item:hover { background: rgba(255,255,255,.1) }` | Hover invisível |
| `mfa-input.component.scss` | `color: var(--white)`; `::placeholder { rgba(255,255,255,.5) }` | Dígitos ilegíveis |
| `mfa-input.component.scss` | `// #20142a` — comentário com hex de tema antigo | Documentação enganosa |
| `switch.component.scss:25` | `.button { background-color: #ffffff }` | Botão branco sobre pista clara |
| `button.component.scss:20,74,89` | `color: #ffffff` | Aceitável sobre `--primary-color`, mas fixa o contraste independentemente do tema |

`--white` é uma cor de **paleta** (`_color.scss`), não um token **semântico** (`_color-definitions.scss`).
Usá-la como cor de texto é o erro de base: o token correto é `--app-text-color`, que cada tema
redefine.

Os dois piores infratores — `autocomplete` e `mfa` — não são coincidência: são os dois componentes
menos usados, logo os menos testados nos temas alternativos.

---

### U-10 · Sem `prefers-reduced-motion` em nenhum dos 10 componentes — **Média**

`grep -rn "prefers-reduced-motion" src` devolve **5 ocorrências, todas em `pages/`**
(`login`, `register`, `book`, `home`, `outlet`), **zero em `shared/ui/atoms/`**.

Ou seja: as páginas respeitam a definição do sistema operativo, e depois enchem-se de átomos que a
ignoram. Animações não protegidas:

| Animação | Local | Gravidade |
|---|---|---|
| `spin 1s linear infinite` | `autocomplete-input.component.scss` | **Alta** — rotação permanente, gatilho vestibular clássico |
| `selectSlideDown` / `selectSlideUp` 200 ms | `select.component.scss:190,227` | Média |
| `.arrow.rotate` 300 ms | `select.component.scss:163-172` | Média |
| Floating label `top` 300 ms | `text-input.component.scss:38` | Média |
| `.error-messages` altura 300 ms | `text-input.component.scss:114` | Média |
| Knob do switch `transition: .4s` | `switch.component.scss:13,22` | Baixa |
| `.strength-bar` `background-color .3s` | `text-input.component.scss:70` | Baixa (só cor) |

**Falha WCAG 2.3.3 Animation from Interactions (Nível AAA)** — e, no caso do spinner infinito,
aproxima-se de **2.2.2 Pause, Stop, Hide (Nível A)**.

Correção de uma linha para toda a pasta, num parcial partilhado importado por cada `.scss`:

```scss
@media (prefers-reduced-motion: reduce) {
	*, *::before, *::after {
		animation-duration: .01ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: .01ms !important;
	}
}
```

---

### U-11 · `autocomplete-input`: fecho por `setTimeout`, API morta, sem teclado — **Média** (componente não usado)

**Onde:** `autocomplete-input.component.ts:47,79-85,99`

```ts
onBlur() {
	// Small delay to allow click on option
	setTimeout(() => { this.isOpen.set(false); this.onTouched(); }, 200);
}
```

Corrida clássica: se o utilizador demorar mais de 200 ms entre `mousedown` e `mouseup` (toque lento,
arrastar para selecionar, dispositivo com throttling), o dropdown fecha antes do clique aterrar e a
seleção perde-se silenciosamente. A solução canónica é
`(mousedown)="$event.preventDefault()"` na opção — o campo nunca perde o foco, e o `setTimeout`
desaparece.

`debounceTime = input<number>(300)` (`:47`) está declarado e **nunca é lido** em nenhum ficheiro do
componente. `queryChange` é emitido a **cada tecla** (`:62`). Um consumidor que leia a API assume
proteção contra rajadas de pedidos e não a tem — armadilha direta para um pedido HTTP por tecla.

Acresce: `setDisabledState` vazio (U-06), sem `role="combobox"`/`listbox`, sem navegação por setas,
e as opções são `<div (click)>` sem `tabindex`.

Como o componente **não está no bundle** (secção 3.2), o custo hoje é zero. A recomendação é
**eliminar**, não corrigir — mantê-lo é manter um molde defeituoso à espera de ser copiado.

---

### U-12 · `list-checkbox` escreve dentro de um `input()` — **Média**

**Onde:** `list-checkbox.component.ts:14-16`

```ts
OnItemChange(item: ListCheckboxItem) {
	item.checked = !item.checked;
}
```

O componente muta o objeto que recebeu através de `items = input<ListCheckboxItem[]>([])`. Não emite
nenhum `output`. Consequências:

- O pai **não é notificado** da alteração. Se o pai for `OnPush`, a sua vista não é marcada como
  suja — o array é o mesmo objeto, o signal `items` não muda de identidade, e nada dispara deteção
  do lado de cima.
- O estado vive dentro dos dados do pai mas é escrito pelo filho: fluxo bidirecional escondido, o
  oposto do modelo de signals que o resto da pasta segue.
- Não é um `ControlValueAccessor`, pelo que **não pode ser usado com formulários reativos** — ao
  contrário de `app-checkbox`. Terceira variante de checkbox, terceiro contrato.

Menor, na mesma linha: `track $index` (`.html:1`) quando os itens têm `id` — reordenar a lista
recria todos os nós do DOM em vez de os mover.

Padrão análogo em `list-switch` (`.ts:22-24`): `isItemSelected` compara por `item.name`, não por
`item.id`. Dois itens com o mesmo nome de exibição ficam permanentemente ligados; renomear um item
perde a seleção.

---

### U-13 · `switch`: o knob nunca se move e o estado desativado não é visível — **Média**

**Onde:** `switch.component.scss:17-31`, `switch.component.html:11-13`

```scss
.checkmark {
	display: flex;                    // filhos são itens flex, position: static
	&.checked .button { left: 20px; } // :18
	.button {
		left: 0;                      // :23
		/* nenhuma declaração de position */
	}
}
```

`left` **não tem efeito em elementos com `position: static`**. Confirmado no CSS compilado
(`chunk-P6G4VJBM.js`): a regra é emitida tal como está, sem `position`. O knob não desliza — a única
alteração visual entre ligado e desligado é o preenchimento da pista, produzido pelo truque de
`box-shadow: -20px 0 0 10px var(--primary-color)` (`:29-30`).

O resultado pode parecer aceitável, mas a `transition: .4s` no `.button` (`:22`) está a animar uma
propriedade inerte: **400 ms de animação declarada que não anima nada**, enquanto a mudança real de
cor acontece instantaneamente. O componente promete um movimento que não entrega.

Separadamente, o template liga uma classe que não existe no CSS:

```html
<div class="checkmark" [class.checked]="value()" [class.disabled]="disabled()">
```

`.checkmark.disabled` **não tem nenhuma regra**. Um switch desativado é visualmente idêntico a um
ativo — o utilizador clica e nada acontece, sem explicação. Combinado com U-01 (`display:none`),
isto significa que o estado desativado não é comunicado por nenhum canal: nem visual, nem semântico,
nem por teclado.

---

### U-14 · `button`: `:focus` em vez de `:focus-visible`, e botões só de ícone sem nome — **Média**

**Onde:** `button.component.scss:67-69`

```scss
&:focus {
	outline: 2px solid var(--app-text-color);
}
```

`:focus` dispara também em clique de rato, deixando um anel de foco persistente após cada clique —
ruído visual que a maioria dos utilizadores lê como um bug. `:focus-visible` mostra o anel apenas
quando o foco vem do teclado. O `select` já usa `:focus-visible` (`select.component.scss:81`);
o `button`, com **28 usos**, não. Em toda a aplicação há apenas 2 ficheiros a usar `:focus-visible`.

**Nome acessível.** Há **9 usos de `radio="square"`** (`aspect-ratio: 1/1`, `padding: 5px` —
`button.component.scss:62-65`), a forma canónica de um botão só de ícone. O componente projeta
`<ng-content>` entre os ícones; num botão só de ícone esse conteúdo é vazio, e o `<app-icons>` é uma
`<div>` com `[innerHTML]` de SVG sem `<title>` nem `aria-label`. **O `<button>` fica sem nome
acessível** — um leitor de ecrã anuncia "botão" e nada mais.

O componente não expõe nenhum `input` para `aria-label`, pelo que o consumidor não tem como
corrigir a partir de fora sem contornar a API. **Falha WCAG 4.1.2 (Nível A)**.

Menor: `<button [class]="buttonClass()">` (`.html:18,29,40`) — o `[class]` como string substitui
todo o atributo, pelo que qualquer classe adicional posta no host pelo consumidor é apagada em cada
recomputação. `[ngClass]` ou o `host` binding seriam mais seguros.

---

### U-15 · `label[for]` pode ficar `undefined` — **Baixa**

**Onde:** `text-input.component.ts:42` (`id = input<string>()`, **sem valor por omissão**),
`text-input.component.html:19,31` (idem `text-area.component.ts:42`)

```html
<input [id]="id()" ... />
<label [for]="id()">{{ label() || placeholder() }}</label>
```

Se o consumidor omitir `id`, ambos ficam `undefined`: o label deixa de estar associado ao input.
Clicar no texto do label não foca o campo, e o leitor de ecrã não anuncia o nome do campo.

**Falha WCAG 1.3.1 (Nível A)** e **3.3.2 Labels or Instructions (Nível A)** quando ocorre.

Correção trivial e à prova de esquecimento: gerar um id de fallback com
`inject(_IdGenerator)` do CDK, ou `id = input<string>(\`input-${crypto.randomUUID()}\`)`.

Relacionado: o `.floating-label` do `select` (`select.component.html:22`) é um `<span>` sem qualquer
ligação ao `role="combobox"` — falta `aria-labelledby`.

---

### U-16 · Erro de escrita numa classe pública e código morto — **Baixa**

| Item | Local | Nota |
|---|---|---|
| Classe `.ative` (deveria ser `active`/`ativa`) | `text-input.component.html:32`, `.scss:44`; `text-area` idem | Uma classe CSS é um contrato; corrigir mais tarde exige tocar em ambos os ficheiros de dois componentes |
| `ngAfterViewInit() {}` vazio | `text-area.component.ts:72` | Componente implementa `AfterViewInit` sem necessidade |
| `input dropdownPosition` nunca lido | `select.component.ts:64` | API que promete algo que não faz (ver P-05) |
| `input debounceTime` nunca lido | `autocomplete-input.component.ts:47` | Idem (ver U-11) |
| `passwordRequirements`/`strengthScore`/`passwordInputType`/`passwordRightIcon` stubs na classe base | `text-input.component.ts:56-73` | A classe base conhece a subclasse para partilhar template — inversão de dependência |
| `.checkmark.disabled` ligado mas sem regra | `switch.component.html:12` | Ver U-13 |
| `.drop-top` com regras mas nunca aplicada | `select.component.scss:221-228` | Ver P-05 |

---

### U-17 · Testes que não podem falhar — **Baixa**

Seis ficheiros `.spec.ts` (`button`, `checkbox`, `list-checkbox`, `list-switch`, `select`, `switch`,
`text-input`), todos com o mesmo conteúdo gerado pelo CLI:

```ts
it('should create', () => {
	expect(component).toBeTruthy();
});
```

Estes testes passam com a `checkbox` sem CSS, com o `switch` inalcançável por teclado, com o
`mfa-input` que não repinta e com o `text-area` que não desativa. **Nenhum dos defeitos críticos
deste relatório seria detetado pela suite atual.** `select.component.spec.ts` (111 linhas) é a única
exceção parcial.

Faltam ainda specs para `text-area`, `mfa-input` e `autocomplete-input`.

Um teste que exercite o contrato — "`form.disable()` desativa o elemento", "`writeValue` repinta a
vista", "o input é alcançável por `Tab`" — falharia hoje em quatro componentes. É o mecanismo que
impede que estes defeitos regressem depois de corrigidos.

---

## 6. Achado transversal: o contrato de formulário está do lado errado

Não é um defeito de um componente, mas a causa de vários. O padrão de integração exigido hoje:

```html
<app-input
  formControlName="email"
  [errors]="this.form.get('email')?.errors"        <!-- redundante -->
  [touched]="this.form.get('email')?.touched ?? false"   <!-- redundante -->
/>
```

O `formControlName` já dá ao componente acesso total ao `AbstractControl`. Os inputs `errors` e
`touched` são uma reimplementação manual, do lado do consumidor, de informação que o componente
podia ler sozinho:

```ts
private ngControl = inject(NgControl, { optional: true, self: true });
protected errors = computed(() => this.ngControl?.control?.errors ?? null);
protected touched = computed(() => this.ngControl?.control?.touched ?? false);
```

Custos do padrão atual, todos observáveis no código:

1. **18 linhas de boilerplate** repetidas em 9 pontos de uso, cada uma uma oportunidade de esquecer
   (em `login.component.html:31` o `[errors]` está lá, e no campo de e-mail o `[touched]` **não
   está** — inconsistência já presente).
2. `form.get('...')` percorrido a cada ciclo de deteção do pai (P-02).
3. `touched` é ignorado na prática por causa do bug de `firstLostFocus` (U-03) — o consumidor liga um
   input que não faz nada.
4. Impede a correção de U-03: sem acesso ao controlo, o componente não pode reagir a
   `statusChanges` para anunciar erros via `aria-live` no momento certo.

> ⚠️ **Ressalva de âmbito.** Injetar `NgControl` com `self: true` obriga a remover o provider
> `NG_VALUE_ACCESSOR` do array `providers` do componente (para evitar dependência circular) e a
> registá-lo via `ngControl.valueAccessor = this` no construtor. É uma alteração de arquitetura que
> toca nos 5 CVAs e nos 9 consumidores. **Não deve ser feita no mesmo lote que as correções de
> acessibilidade** — estas são independentes, de baixo risco e devem ir primeiro.

---

## 7. Backlog priorizado

Ordenado por (impacto no utilizador × alcance) ÷ risco de alteração.

### Vaga 1 — Acessibilidade bloqueante (baixo risco, alto impacto)

| # | Ação | Ficheiros | Achado |
|---|---|---|---|
| 1 | Substituir `input { display: none }` pelo padrão *visually-hidden*; adicionar `role="switch"` + `aria-checked` | `switch` | U-01 |
| 2 | Dar cor (`--danger-color`), `role="alert"`, `aria-invalid` e `aria-describedby` às mensagens de erro | `text-input`, `text-area` | U-03 |
| 3 | Corrigir a condição de `firstLostFocus` para respeitar o `touched` do formulário | `text-input.component.ts:151`, `text-area.component.ts:119` | U-03 |
| 4 | Implementar `setDisabledState` a sério | `text-area`, `autocomplete` | U-06 |
| 5 | Tornar o alternador de password um `<button type="button">` com `aria-label` + `aria-pressed`; corrigir o ícone invertido | `text-input` | U-07 |
| 6 | `id` com fallback gerado | `text-input`, `text-area` | U-15 |
| 7 | Expandir o alvo de toque do `switch` para ≥24 px com pseudo-elemento | `switch` | U-08 |
| 8 | Adicionar bloco `prefers-reduced-motion` partilhado a todos os `.scss` da pasta | 10 ficheiros | U-10 |

### Vaga 2 — Defeitos funcionais

| # | Ação | Ficheiros | Achado |
|---|---|---|---|
| 9 | Converter `digits` para `signal` (ou `markForCheck` em `writeValue`); adicionar `autocomplete="one-time-code"`, `aria-label` por caixa, filtragem numérica e setas | `mfa-input` | U-05 |
| 10 | Navegação por teclado no `select` via `ActiveDescendantKeyManager` do CDK; foco no campo de pesquisa ao abrir; devolver foco ao trigger ao fechar | `select` | U-04 |
| 11 | Adicionar `position: relative` ao knob (ou migrar para `transform: translateX`) e estilizar `.checkmark.disabled` | `switch` | U-13 |
| 12 | `:focus` → `:focus-visible`; expor `ariaLabel` como `input` | `button` | U-14 |
| 13 | Substituir `var(--white)`/`#ffffff`/`rgba(255,255,255,…)` por tokens semânticos | `autocomplete`, `mfa`, `switch`, `button` | U-09 |

### Vaga 3 — Decisão de produto (bloqueia trabalho seguinte)

| # | Ação | Achado |
|---|---|---|
| 14 | **Decidir:** `app-checkbox` recebe o desenho do `list-checkbox`, ou é eliminado. Não manter dois desenhos | U-02 |
| 15 | **Decidir:** eliminar `autocomplete-input` e `list-switch` (0 usos, ausentes do bundle) ou assumi-los e corrigi-los | 3.2, U-11 |
| 16 | Converter `list-checkbox` num `ControlValueAccessor` que compõe `app-checkbox`, ou emitir um `output` em vez de mutar o `input()` | U-12 |

### Vaga 4 — Performance

| # | Ação | Ganho esperado | Achado |
|---|---|---|---|
| 17 | Trocar `transition: all` por listas explícitas; reservar espaço do label com `padding-top`; animar `transform` em vez de `top` | Elimina ~18 reflows do formulário por evento de foco `[modelado]` | P-01 |
| 18 | `errorMessages`, `isSelected`, `iconSize` → `computed()` | Elimina ~600 chamadas/ciclo num select de 200 opções `[modelado]` | P-02, P-03 |
| 19 | `CdkVirtualScrollViewport` no dropdown do `select` acima de ~50 opções | Corta N instâncias de `IconsComponent` | P-03 |
| 20 | Suspender `backdrop-filter` durante a animação de abertura; degradar em `max-width: 768px` | Remove leitura+blur do backdrop por frame durante 200 ms | P-04 |
| 21 | Remover CSS morto do `select` (`z-index !important`, `.drop-top`, `.is-open`) e o `input dropdownPosition` | Redução de parte dos 6.168 bytes medidos | P-05 |

### Vaga 5 — Rede de segurança

| # | Ação | Achado |
|---|---|---|
| 22 | Substituir os 6 specs `should create` por testes de contrato: `disable()` desativa, `writeValue` repinta, `Tab` alcança o controlo, `aria-invalid` reflete o erro | U-17 |
| 23 | Criar specs para `text-area` e `mfa-input` | U-17 |
| 24 | Adicionar axe-core ao pipeline de testes dos átomos | U-01…U-15 |

---

## 8. Riscos e o que falta verificar

### Riscos das correções propostas

| Ação | Risco | Mitigação |
|---|---|---|
| Tornar o `<input>` do switch focável (#1) | O anel de foco vai passar a aparecer onde antes não aparecia — pode ser lido como regressão visual | Desenhar o estado de foco no `.checkmark` via `input:focus-visible + .checkmark`, como o `list-checkbox` já faz |
| `padding-top` fixo em vez de `margin-top` (#17) | Altera a altura de repouso de **todos** os 16 `app-input` — impacto de layout em todas as páginas de formulário | Alteração visual; exige revisão página a página, não só teste unitário |
| `:focus` → `:focus-visible` (#12) | Browsers muito antigos sem suporte perdem o anel de foco por completo | Manter `:focus` como fallback antes da regra `:focus-visible` |
| Injetar `NgControl` (secção 6) | Dependência circular com `NG_VALUE_ACCESSOR` se feito ingenuamente | Lote separado, depois das vagas 1–2 |
| Eliminar `autocomplete-input` (#15) | Pode existir trabalho em curso noutro branch que dependa dele | Confirmar com o autor antes de apagar |

### O que esta análise não conseguiu determinar

1. **Nenhum número de performance foi medido em runtime.** Todos os custos de layout na secção 4
   estão marcados `[modelado]`. Antes de aceitar #17 ou #20, é preciso um trace do DevTools durante
   focus/blur num formulário real e durante a abertura do dropdown, em CPU com throttling 4×.
2. **Nenhum teste com leitor de ecrã real.** As falhas de WCAG apontadas são determinísticas por
   inspeção de DOM, mas o comportamento exato do NVDA/VoiceOver com o `role="combobox"` do `select`
   depois de #10 só se confirma testando.
3. **Contraste de cor não foi medido.** U-09 identifica cores fixas em temas claros por
   raciocínio sobre tokens, não por cálculo de rácio. Uma auditoria de contraste (SC 1.4.3) sobre os
   5 temas é trabalho autónomo e provavelmente encontrará mais casos.
4. **Não foi verificado se o `select` fecha corretamente em `Tab`.** O overlay do CDK tem
   `overlayOutsideClick` mas nenhuma estratégia de *focus trap* — o comportamento com teclado só
   ficará determinado depois de #10.
5. ~~Verificar se o CSS do `checkbox` se perdeu num commit anterior.~~ **Verificado durante esta
   análise — não se perdeu nada.** Ver U-02: o ficheiro nasceu vazio e nunca teve conteúdo. A
   correção é trabalho novo, não uma reversão.
