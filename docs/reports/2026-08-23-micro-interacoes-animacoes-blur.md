# Micro-interações, animações e o custo do blur — fundação de movimento

**Data:** 2026-08-23 · **Branch:** `developer` · **Commit base:** `912fc3d` (+3 ficheiros não
commitados) · **Modo:** análise/proposta — nada aqui foi implementado.
**Escopo:** os 83 ficheiros `.scss` de `src/` e `public/assets/scss`, o bloco inline de
`src/index.html` e `src/app/app.config.ts`.
**Relatórios irmãos:** [`inputs`](./2026-08-23-inputs-atoms-performance-usability.md) ·
[`chapters`](./2026-08-23-chapters-performance-usability.md) ·
[`readers`](./2026-08-23-readers-performance-usability.md) ·
[`book-grid`](./2026-08-23-book-grid-context-menu-item-book-performance-usability.md)

| Campo | Valor |
|---|---|
| **Status** | 🟡 Parcial — há 54 `@keyframes` e 163 `transition` no código, mas **nenhuma fundação**: sem tokens, sem contrato de propriedades, sem níveis de efeito |
| **Cobertura** | Movimento: ~10 % (6 de 58 ficheiros com animação respeitam `prefers-reduced-motion`) · Blur: ~22 % (6 de 27 superfícies com fallback) |
| **Esforço** | 6,5–9,5 dias-dev na fundação (F0–F5); 8,5–12,5 d com a direção estética (F6); 2–2,5 d no mínimo viável |
| **Depende de** | Nada — pode começar já |
| **Atenção** | ⚠️ Nenhuma medição em dispositivo real foi feita. Todo custo de runtime neste relatório está marcado `[modelado]` |

---

## 1. Estado atual — evidências

### 1.1 O que já existe

O site **já tem bastante movimento**. O que ele não tem é um sistema. Os números vêm de `grep`
sobre os 83 ficheiros `.scss` do repositório:

| Métrica | Valor | Como foi obtido |
|---|---|---|
| Ficheiros `.scss` | 83 | `find src public -name "*.scss" \| wc -l` |
| Ficheiros com `transition:` ou `animation:` | 58 | `grep -rl` |
| Ocorrências de `transition` | 163 | `grep -rn` |
| Blocos `@keyframes` | 54 | `grep -rn "@keyframes"` |
| Linhas com `infinite` (21 ficheiros) | 30 | `grep -rn infinite` |
| `transform:` | 196 | `grep -rn` |
| `will-change` | 4 | `grep -rn` |
| `contain:` | 0 | `grep -rn "contain:"` → 0 resultados |

A aplicação é *zoneless* (`app.config.ts:34`), o que significa que **nada disto passa por
`NgZone`** — as animações são inteiramente CSS e não geram ciclos de detecção de mudança. Esse é o
ponto de partida certo, e a proposta desta análise **não o abandona**.

Existe uma única biblioteca de estilo partilhada, `public/assets/scss/_mixins.scss` (89 linhas),
com dois grupos: o *skeleton* (`:1-45`) e o *glassmorphism* (`:47-89`). O skeleton é o **único
efeito do repositório que já foi endurecido para performance** — o comentário em `:24-26` regista
o motivo real (o `infinite` mantinha o *refresh driver* do Firefox acordado) e desliga a animação
sob `prefers-reduced-motion` em `:27-31`.

### 1.2 O que não existe — provas de ausência

```bash
grep -rn "deviceMemory\|hardwareConcurrency\|navigator.connection\|saveData" src/
# → 0 resultados
```

Não existe **nenhuma** detecção de capacidade de dispositivo. A decisão de ligar ou desligar um
efeito é hoje tomada exclusivamente por *media query* estática.

```bash
grep -rn "@angular/animations" src/
# → 0 resultados
grep -rl "AnimationBuilder\|@angular/animations\|ɵAnimationEngine" dist/front/browser/*.js
# → 0 resultados  (build de produção real, exit 0, 5,956 s, executado nesta análise)
```

`@angular/animations` está declarado em `package.json:23` e `provideAnimationsAsync()` está em
`app.config.ts:44`, mas **nenhum trigger existe** e o pacote **não chega ao bundle de produção** —
o carregamento assíncrono nunca é disparado. Custo atual: zero bytes no cliente. Isso é medido, não
estimado.

```bash
grep -rn "contain:" src/ public/ --include="*.scss"
# → 0 resultados
```

Nenhuma superfície animada declara *containment*. Três ficheiros usam `content-visibility: auto`
(`info-book.component.scss:326,558` · `item-book.component.scss:203`), que é a ferramenta vizinha,
não a mesma.

Não existe ficheiro de tokens de movimento. A consequência é mensurável — **16 durações distintas
e 6 curvas de aceleração distintas** convivem no repositório:

| Duração | Ocorrências | | Easing | Ocorrências |
|---|---|---|---|---|
| `0.2s` | 72 | | `cubic-bezier(0.32, 0.72, 0, 1)` | 31 |
| `0.3s` | 52 | | `cubic-bezier(0.4, 0, 0.2, 1)` | 23 |
| `0.4s` | 7 | | `cubic-bezier(0, 0, 0.2, 1)` | 3 |
| `300ms` | 6 | | `cubic-bezier(0.4, 0, 0.6, 1)` | 2 |
| `250ms` | 5 | | `cubic-bezier(0.5, 0.1, 0.5, 0.9)` | 1 |
| outras 11 | 21 | | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 1 |

`0.3s` e `300ms` são o mesmo valor escrito de duas formas. As duas curvas dominantes (31 e 23 usos)
são visualmente diferentes e não há regra que diga qual usar quando.

`public/assets/scss/global.scss:213` abre uma secção `// --- Performance Utilities ---` e o
ficheiro **termina na linha seguinte, vazia**. O lugar da fundação já foi reservado e nunca
preenchido.

### 1.3 ⚠️ Defeito: o fallback de blur protege as superfícies erradas

Há 27 superfícies com `backdrop-filter` (23 via mixin + 4 declarações diretas) e 10 com
`filter: blur()`. A distribuição por intensidade:

| Mixin | Raio · saturação | Usos | Tem fallback? |
|---|---|---|---|
| `glass-heavy` | `blur(96px) saturate(200%)` | 4 | ❌ nenhum |
| `glass-panel` | `blur(24px) saturate(180%)` | 3 | 🟡 2 de 3 |
| `glass-overlay` | `blur(12px)` | 6 | ❌ nenhum |
| `glass-dropdown` | `blur(8px) saturate(160%)` | 2 | ❌ nenhum |
| `glass-medium` | `blur(8px)` | 2 | ❌ nenhum |
| `glass-light` | `blur(4px)` | 6 | ❌ nenhum |
| declarações diretas, fora do mixin | `blur(10px)`–`blur(24px)` | 4 | ✅ 4 de 4 |

O `glass-heavy` — o efeito **mais caro do repositório** — está em `user-menu.organism.scss:23`,
`notification-menu.organism.scss:37`, `theme-setup-modal.component.scss:18` e
`overlay-notification.component.scss:47`. Nenhum dos quatro tem qualquer fallback.

O caso de `overlay-notification` é o pior e vale ser lido inteiro, porque é **o container de todos
os modais da aplicação**:

```scss
// overlay-notification.component.scss:12-25 — o backdrop
.modal-backdrop {
	position: fixed; width: 100vw; height: 100vh;
	@include glass-overlay;              // blur(12px) sobre a viewport inteira
	opacity: 0;
	transition: opacity 0.3s ease;       // anima por cima do backdrop-filter
	transform: translateZ(0);
}
```

```scss
// overlay-notification.component.scss:44-58 — o conteúdo, por cima do backdrop
.modal-content {
	@include glass-heavy;                // blur(96px) saturate(200%)
	animation: modalAppear 0.5s cubic-bezier(0.32, 0.72, 0, 1);
	will-change: transform, opacity;
}
```

São **duas leituras do backdrop empilhadas**, uma delas cobrindo a viewport inteira, ambas ativas
durante 500 ms de animação de entrada, em todo modal que a aplicação abre. **Custo [modelado]:** o
*readback* do backdrop é proporcional à **área**, não ao raio — a camada de 96px é cara pelo raio,
a de `100vw × 100vh` é cara pela área, e a segunda está a ser recomposta a cada frame porque a
`opacity` está a animar por cima dela.

Onde existe fallback, ele é este padrão, repetido literalmente em 5 ficheiros
(`home.component.scss:425-437` · `book.component.scss:754-758` · `tags.component.scss:284-293` ·
`sensitive-content.component.scss:435-447` · `book-filter.component.scss:497-511`, os três últimos
**ainda não commitados**):

```scss
// book-filter.component.scss:499-511 (não commitado)
@supports (-moz-appearance: none) {
	@media (pointer: coarse), (max-width: 768px) {
		.advanced-filters {
			backdrop-filter: none !important;
			-webkit-backdrop-filter: none !important;
```

Três problemas, e o pedido do utilizador atinge exatamente os três:

1. `@supports (-moz-appearance: none)` **não é uma feature query, é um sniff de Firefox**. Nenhum
   iPhone e nenhum Chromium de baixo custo entra neste bloco — que são precisamente os dois alvos
   nomeados no pedido.
2. A condição é *hardware barato* mas o que se mede é *largura de ecrã*. Um iPad Pro de 2024 em
   modo retrato não passa; um Android de 2 GB em landscape passa.
3. São 43 linhas duplicadas em 5 ficheiros, cada uma repetindo o seletor da superfície que
   desliga. Cada nova superfície de vidro exige uma sexta cópia — e as 22 superfícies que ninguém
   copiou continuam sem proteção.

### 1.4 ⚠️ Defeito: 104 regras `:hover` sem guarda de ponteiro

```bash
grep -rn ":hover" src/ --include="*.scss" | wc -l      # → 104
grep -rn "hover: *hover" src/ public/ --include="*.scss"
# → 1 resultado: chapters.component.scss:415
```

Em ecrã tátil, o browser aplica `:hover` no toque e **mantém o estado colado** até o próximo toque
noutro sítio. Com 104 regras e uma única guarda, qualquer micro-interação de *hover* que se
acrescente agora nasce partida em telemóvel. `:focus-visible` aparece 2 vezes e `:active` 18 —
ou seja, o estado que o toque realmente produz é o menos estilizado dos três.

Este defeito **não é causado pelo pedido**, mas é a primeira coisa que o pedido vai multiplicar:
adicionar micro-interações de *hover* sem resolver isto transforma um bug latente em 104 bugs
visíveis.

### 1.5 ⚠️ Defeito: `scale()` dentro de um layer com `blur(90px)`

```scss
// home.component.scss:19-35 (idêntico em book.component.scss:94-95 e outlet.component.scss:23-24)
.aurora-orb {
	filter: blur(90px);
	will-change: transform;
	&--warm { width: 700px; height: 500px; animation: orb-float-a 22s ease-in-out infinite; }
}
```

```scss
// home.component.scss:78-82
@keyframes orb-float-a {
	0%, 100% { transform: translate(0, 0) scale(1); }
	33%      { transform: translate(-30px, 40px) scale(1.06); }
```

O `will-change: transform` promove o orb a layer próprio e o `blur(90px)` é rasterizado uma vez —
esse é o caso bom, e é por isso que `filter` num elemento animado é muito mais barato que
`backdrop-filter`. Mas o keyframe anima `scale()`, e **escalar um layer rasterizado força
re-rasterização** para manter nitidez em vários motores. **Custo [modelado]:** re-blur de uma
superfície de 700 × 500 px a cada frame durante 22 s, em loop infinito, em três páginas
diferentes. Trocar `scale()` por `translate()` puro custa uma linha e remove o risco inteiro.

O bloco `prefers-reduced-motion` em `home.component.scss:90-92` já desliga esta animação — mas
apenas para quem ativou a preferência no sistema operativo, que é uma minoria.

---

## 2. As sete decisões de design

### 2.1 Tokens de movimento, em `_motion.scss`

Um ficheiro novo, `public/assets/scss/_motion.scss`, expondo custom properties em `:root` — não
variáveis Sass. A razão é concreta: uma custom property pode ser **redefinida por
`prefers-reduced-motion` e por nível de efeito sem recompilar nem duplicar seletores**, e uma
variável Sass não pode.

```scss
// _motion.scss — proposta
:root {
	--fx-fast: 120ms;      --fx-base: 200ms;      --fx-slow: 320ms;
	--fx-out:  cubic-bezier(0, 0, 0.2, 1);
	--fx-inout: cubic-bezier(0.32, 0.72, 0, 1);   // a curva já dominante: 31 usos
}
@media (prefers-reduced-motion: reduce) {
	:root { --fx-fast: 1ms; --fx-base: 1ms; --fx-slow: 1ms; }
}
```

As 16 durações colapsam em 3 e as 6 curvas em 2 — `cubic-bezier(0.32, 0.72, 0, 1)` (31 usos) e
`cubic-bezier(0, 0, 0.2, 1)` para entradas rápidas. Um único bloco `prefers-reduced-motion` no
`:root` passa a cobrir **todos os 58 ficheiros com movimento**, contra os 6 de hoje. É a mudança
de maior retorno por linha de código deste relatório.

### 2.2 O contrato: `transform` e `opacity`, e mais nada

Regra dura para toda micro-interação nova: **só se anima `transform` e `opacity`**. São as duas
únicas propriedades que os três motores alvo compõem na GPU sem *layout* nem *paint*. O
repositório já respeita isto quase por completo — há **1 única** transição de propriedade de
layout, `book.component.scss:379` (`transition: font-size 0.2s ease`), e ela é o contraexemplo
que confirma a regra.

Os 45 `transition: all` espalhados por 27 ficheiros violam o contrato por omissão: `all` inclui
`width`, `height` e `box-shadow`. Não é preciso reescrever os 45 agora — mas nenhum novo deve
entrar, e os 5 de `book-edit-modal.component.scss` estão no caminho da fase F3.

### 2.3 Não detectar o dispositivo — medir o resultado e degradar

`src/index.html:5-36` já executa um script inline **bloqueante** que escreve `data-theme` no
`<html>` antes da primeira pintura. É o gancho de que a proposta precisa: acrescentar `data-fx` no
mesmo bloco custa ~8 linhas, não adiciona pedido de rede e não introduz *flash*. Dois níveis,
`full` e `lite` — três exigiriam decidir uma fronteira intermédia que nenhum sinal justifica.

**Correção a este relatório:** a primeira versão afirmou que `navigator.hardwareConcurrency` não
existe no Firefox nem no Safari. **Está errado** — `hardwareConcurrency` é suportado nos três
motores alvo; apenas `deviceMemory` é exclusivo do Chromium. A conclusão de fundo mantém-se, mas
por outra razão: `hardwareConcurrency` conta núcleos, não capacidade. Um telemóvel barato com 8
núcleos fracos reporta 8, e o Firefox com `privacy.resistFingerprinting` reporta sempre 2 — o que
degradaria injustamente um portátil rápido.

Continua verdade que **não existe API para detectar se o dispositivo aguenta**. Mas a pergunta
certa não é essa. Não é preciso prever o dispositivo: é preciso **medir o que ele entregou** e
reagir. É o padrão de *qualidade adaptativa* que motores 3D usam há vinte anos, e o sinal de que
ele depende — `requestAnimationFrame` e `performance.now()` — funciona nos três motores, ao
contrário de qualquer heurística de hardware.

A sonda, em esboço:

```ts
// fx-probe.service.ts — proposta. ~40 linhas no total.
const deltas: number[] = [];
let last = performance.now();
const tick = (now: number) => {
  deltas.push(now - last); last = now;
  if (deltas.length < 70) requestAnimationFrame(tick);
  else decide(deltas.slice(10));      // descarta os 10 primeiros frames
};
```

Quatro regras que fazem a diferença entre uma sonda útil e uma que estraga a experiência:

1. **Mede durante uma animação que já ia acontecer** — a cena de aurora na `home`, ou a entrada de
   um modal. Medir uma página parada mede o `rAF` ocioso, que é rápido em toda a parte e não diz
   nada.
2. **Descarta os primeiros ~10 frames.** Arranque a frio, hidratação e *layout* inicial competem
   com a animação e enviesam a medição para pessimista.
3. **Só degrada, nunca promove a meio da sessão.** Uma sonda que sobe e desce o nível produz
   *flicker* visível. A promoção acontece na sessão seguinte, ou por acção do utilizador.
4. **Corre no máximo uma vez por sessão, e o veredito é persistido** ao lado de `@gatuno/theme`.
   A segunda visita já arranca no nível certo, antes da primeira pintura — que é o único momento
   em que isto não custa nada.

Numa aplicação *zoneless* (`app.config.ts:34`) um laço de `rAF` **não dispara detecção de
mudança**, por isso a sonda não tem custo de framework. Ela custa ~1 segundo de um laço que já
estaria a correr de qualquer forma, e depois desliga-se.

**A assimetria que governa o desenho:** um falso `lite` custa ao utilizador um site mais sóbrio,
que ele pode reverter nas definições. Um falso `full` custa-lhe um site que engasga, e ele não
sabe porquê nem o que fazer. Na dúvida, degrada. É por isso que a sonda pode ser grosseira sem ser
perigosa.

Os quatro sinais formam uma escada, e **todos convergem para escrever o mesmo atributo**:

| Ordem | Sinal | Disponível em | Papel |
|---|---|---|---|
| 1 | Definição explícita do utilizador | Todos | Ganha sempre. Nada a sobrepõe |
| 2 | `prefers-reduced-motion` | Todos | Sinal explícito do sistema operativo |
| 3 | Veredito medido pela sonda, persistido | Todos | A decisão real, a partir da 1.ª sessão |
| 4 | `hardwareConcurrency` ≤ 4 · `saveData` | 3 e 4 (parcial) | Apenas o palpite inicial, antes de existir medição |

O CSS não sabe qual dos quatro decidiu — lê `[data-fx='lite']` e mais nada. É isso que mantém a
complexidade dentro de um serviço de ~40 linhas em vez de a espalhar pelas 27 superfícies de
vidro.

### 2.4 O substituto do blur

| Opção | O que é | Custo por frame [modelado] | Veredito |
|---|---|---|---|
| **A** — manter `backdrop-filter` | Estado atual | *Readback* do backdrop ∝ área + blur ∝ raio | Mantido **apenas** no nível `full` |
| **B** — cor sólida via `color-mix` | O fallback que já existe em 5 ficheiros | Zero. É uma cor. | **Recomendada** para o nível `lite` |
| **C** — reduzir raio de `glass-heavy` 96px → 24px | Uma linha em `_mixins.scss:88` | Reduz o custo de blur; não reduz o *readback* | **Recomendada**, independente do nível |
| **D** — camada pré-borrada estática (imagem gerada em build) | `background-image` já borrado, sem filtro em runtime | Zero em runtime; +bytes e não acompanha o conteúdo | Rejeitada: o fundo dos modais é dinâmico |
| **E** — `filter: blur()` num clone do conteúdo | Duplicar o DOM por baixo do painel | Pior que A: duplica *paint* e dobra o DOM | Rejeitada |
| **F** — ruído/gradiente estático a fingir vidro | Textura fixa com opacidade | Zero | Complemento estético de B, não substituto |

A recomendação é **B + C juntas**, e a ordem importa: C sozinha já reduz o efeito mais caro do
repositório com uma linha, e beneficia **todos os dispositivos, incluindo os rápidos**, antes de
qualquer trabalho de detecção. B entra depois, por token.

O mecanismo que justifica C: o custo de `backdrop-filter` divide-se em duas parcelas — copiar a
região que está por trás (∝ área) e borrá-la (∝ raio, sublinear porque os motores fazem
*downsample*). `glass-heavy` a 96 px está no extremo da segunda parcela sem ganho visual
proporcional; a 24 px o resultado é visualmente muito próximo. **Isto é uma afirmação sobre o
mecanismo, não uma medição** — a comparação visual e o ganho real precisam do teste da secção 5.

A implementação passa por trocar os valores fixos dos mixins por tokens, o que elimina de uma vez
as 43 linhas duplicadas de `!important` da secção 1.3:

```scss
// _motion.scss — proposta
:root       { --fx-blur-heavy: 24px; --fx-blur-panel: 16px; --fx-blur-light: 4px; }
[data-fx='lite'] { --fx-blur-heavy: 0px; --fx-blur-panel: 0px; --fx-blur-light: 0px; }
```

```scss
// _mixins.scss:51-59 — reescrito
@mixin glass-backdrop($blur, $saturate: null) {
	@supports (backdrop-filter: blur(1px)) {
		backdrop-filter: blur($blur) …
```

Com `--fx-blur-heavy: 0px`, o `backdrop-filter: blur(0px)` continua a criar um *stacking context*
mas não borra. Para chegar a custo verdadeiramente zero é preciso `backdrop-filter: none` — o que
exige uma segunda regra por nível, não apenas um token. **É a única parte da proposta onde o token
sozinho não chega**, e a fase F1 tem de a resolver explicitamente.


### 2.4.1 Simular o efeito em vez de o calcular — e o repositório já o faz

A pergunta "há maneira de simular sem pesar" tem uma resposta concreta neste código, e ela já está
em produção em cinco páginas. `BlurhashComponent`
(`src/app/shared/ui/molecules/blurhash/blurhash.component.ts`) descodifica o hash para um canvas
de **32 px de lado, no máximo 64** (`decodeSize():96-119`), com cache LRU de 500 entradas
(`:53`), e o CSS estica esse canvas para o tamanho total do elemento:

```scss
// blurhash.component.scss:7-12
canvas { display: block; width: 100%; height: 100%; object-fit: cover; }
```

**Esticar 32 px para 400 px é um blur.** O filtro bilinear da GPU faz o trabalho durante a
composição, sem passo de *paint*, sem *readback*, e sem custo por frame. O próprio comentário do
componente já reconhece o princípio (`:92-94`): *"o blurhash é uma aproximação de baixa frequência
e ainda é escalado por CSS, então limitar o lado maior não tem custo visual"*.

O princípio generaliza para além do blurhash: **qualquer superfície borrada pode ser desenhada
pequena e ampliada**, em vez de ser desenhada grande e filtrada. É a diferença entre pedir ao
browser que calcule o desfoque e pedir-lhe que o interpole.

Isto acrescenta uma opção que faltava à tabela da secção 2.4:

| Opção | O que é | Custo por frame [modelado] | Veredito |
|---|---|---|---|
| **G** — camada de baixa resolução ampliada | O que o `BlurhashComponent` já faz: desenhar pequeno, esticar por CSS | Zero. É composição | **Recomendada** onde o fundo é uma imagem |

E resolve a objeção que tinha feito a opção **D** ser rejeitada — "o fundo dos modais é dinâmico".
Para o fundo que é uma **capa de livro**, ele não é dinâmico: já existe um hash, já existe um
componente, e já existe a decisão de o esticar. `home.component.scss:427-429` regista, num
comentário, que a equipa já chegou a esta conclusão **uma vez, à mão, num sítio**: o
`backdrop-filter` do painel foi desligado porque *"o fundo atrás dele já é uma imagem com
blur(15px) — o blur do backdrop praticamente não agrega nada visualmente"*. Falta generalizar.

O que sobra do "vidro" depois de tirar o filtro é menos do que parece — e aqui a economia é
perceptual, não computacional:

| O que dá a sensação de vidro | Custo | Veredito |
|---|---|---|
| Borda de 1 px mais clara no topo (*specular edge*) | Zero — é um `border` | **É o que mais vende o efeito** |
| Gradiente interno de destaque, do topo para o meio | Zero — pintado 1× | Recomendado |
| Textura de ruído subtil | Zero — imagem em `data:` URI, ~1 kB | Opcional |
| Desfoque real do que está por trás | *Readback* + filtro por frame | O mais caro, e o menos notado |

A ordem desta tabela é o argumento: **o desfoque é a parte cara e a menos perceptível do
glassmorphism**. Uma superfície translúcida com aresta de luz e gradiente interno lê-se como vidro
sem um único filtro. Isto é uma afirmação sobre percepção visual e **não foi testada com
utilizadores deste produto** — mas é testável em minutos, lado a lado, e a secção 5 pede-o.

### 2.5 Bibliotecas de animação — o que a medição diz

Esta secção substitui uma rejeição que a primeira versão deste relatório fez **sem medir**. Os
números abaixo são reais: cada candidato foi instalado numa árvore isolada e empacotado com
`esbuild --bundle --minify --format=esm` a partir de um import realista (`animate(el, …)` ou
`gsap.to(el, …)`), e o resultado foi comprimido com `gzip`. A base de comparação é o *initial
transfer* medido no build de produção desta análise: **152,54 kB** (564,55 kB *raw*).

| Opção | gzip medido | Sobre os 152,54 kB | Onde a animação corre | Veredito |
|---|---|---|---|---|
| CSS `transition` + `@keyframes` | 0 B | — | Compositor | **Recomendada** como base |
| `motion/mini` | 3,08 kB | +2,0 % | WAAPI → compositor | **Aceite** para o que CSS não exprime |
| `animejs` 4.5 | 12,44 kB | +8,2 % | `rAF`, thread principal | Rejeitada |
| `motion` completo | 22,25 kB | +14,6 % | `rAF` + WAAPI | Rejeitada |
| `gsap` core | 27,03 kB | +17,7 % | `rAF`, thread principal | Rejeitada |
| `gsap` + `ScrollTrigger` | 44,23 kB | +29,0 % | idem | Rejeitada |
| `@angular/animations` | hoje 0 B no bundle (medido, secção 1.2) | — | `rAF` | Rejeitada |
| `lottie-web` | **não medido** | — | Rasterização vetorial por frame | Rejeitada por mecanismo |

**Os bytes são a metade menos importante desta tabela.** GSAP e anime.js animam por
`requestAnimationFrame`: a cada frame o JavaScript calcula o valor e escreve estilo inline no
elemento. Numa CPU fraca esse trabalho disputa a thread principal com a renderização do Angular —
e é aí que a animação engasga, não nos 27 kB. `motion/mini` é outra coisa: é uma casca fina sobre
a **Web Animations API**, entrega a animação ao browser, e `transform`/`opacity` vão parar ao
mesmo sítio onde uma `transition` de CSS já corre. É por isso que é simultaneamente o mais pequeno
e o mais barato — as duas propriedades não são independentes.

**A correção:** rejeitar `motion/mini` em bloco, como a primeira versão fez, estava errado. A
3,08 kB e sem custo de thread principal, ele é a ferramenta certa para os dois casos que CSS puro
não exprime bem — *stagger* (atrasar N elementos por índice sem gerar N classes) e interrupção com
velocidade preservada (o utilizador inverte o gesto a meio e a animação não salta). Fora desses
dois casos, continua a não haver razão para o carregar.

**GSAP continua rejeitado, e agora com o número:** +17,7 % de *initial transfer* para usar
`gsap.to(el, { opacity: 1 })`. O valor real do GSAP está nas *timelines*, no ScrollTrigger e no
morphing de SVG — nada disso aparece no escopo de micro-interações. É comprar a caixa de
ferramentas inteira para usar uma chave de fendas, e pagá-la na thread que este relatório quer
proteger.

### 2.6 A direção "luzes noturnas"

**Não é uma migração — a cena já está construída.** O markup existe em três páginas, idêntico nas
três (`home.component.html:2-7` · `outlet.component.html:2-7` · `book.component.html:3-7`):

```html
<!-- home.component.html:2-7 -->
<div class="aurora-scene" aria-hidden="true">
  <div class="aurora-orb aurora-orb--warm"></div>
  <div class="aurora-orb aurora-orb--cold"></div>
  <div class="aurora-orb aurora-orb--accent"></div>
  <div class="aurora-mesh"></div>
</div>
```

Três orbs com `filter: blur(90px)` sobre `radial-gradient` (`home.component.scss:19-35`) e uma
malha de três gradientes radiais nos cantos (`:68-76`). Isso **já é** uma cena de luzes noturnas.
O que falta não é construí-la: é levá-la para além do fundo, dar-lhe tokens, e decidir o que ela
faz nos temas claros.

O inventário do que o repositório já tem das primitivas do género:

| Primitiva | Usos hoje | Custo | Regra proposta |
|---|---|---|---|
| `radial-gradient` estático | 19 | Pintado uma vez, zero por frame | Base da cena |
| `box-shadow` | 75 | ∝ área × raio | Permitido em elementos pequenos |
| `text-shadow` (*glow* de texto) | 6 | Barato em títulos | Permitido |
| `filter: drop-shadow()` | 2 | Rasteriza forma + blur | Só em ícones SVG |
| `filter: blur()` em camada promovida | 10 | Rasterizado 1×, barato se só `translate` animar | É o que os orbs já fazem |
| `mix-blend-mode` | 1 (`book.component.scss:54`) | Força *stacking context* + leitura do que está por baixo | ❌ **Proibido** em superfície animada |
| `conic-gradient` | 0 | Re-pinta o gradiente a cada frame se animado | ❌ Proibido animado |

⚠️ **Aqui os seus dois pedidos puxam em sentidos opostos, e vale dizê-lo antes de começar.** A
mensagem anterior pediu efeitos leves para aparelhos fracos; o neon é feito exatamente das
primitivas caras — `box-shadow` de raio grande, `blur`, e sobretudo `mix-blend-mode`, que tem o
**mesmo mecanismo de custo do `backdrop-filter`** da secção 1.3: obriga a ler o que está por
baixo. Um site "mais vivo" construído com blend modes animados fica mais pesado do que o blur que
esta análise recomenda remover.

Os dois pedidos são compatíveis sob uma regra única, e só sob ela:

> **A luz pinta-se uma vez. O que anima é a opacidade e a posição da luz já pintada** — nunca o
> raio, nunca a cor, nunca o *spread*, nunca o blend.

Sob essa regra, o custo da direção estética é próximo de zero por frame, porque cai exatamente no
contrato da decisão 2.2. Fora dela, cada *glow* animado é um *repaint* de área grande.

Duas decisões ficam em aberto e são suas, não minhas:

1. **O que acontece nos temas claros.** São 5 temas
   (`_color-definitions.scss:3,70,137,200,249` — `dark`, `true-dark`, `light`, `dracula`,
   `slate`). Luz noturna é uma estética intrinsecamente escura: sobre fundo claro, o *glow* lê-se
   como mancha, não como luz. Ou o `light` recebe um tratamento próprio, ou a direção assume-se
   como identidade dos temas escuros e o `light` fica deliberadamente sóbrio.
2. **Se a cena sai do fundo.** Hoje é decorativa e `aria-hidden`. Levar a luz para os elementos
   — *glow* no card sob o cursor, no capítulo que está a ser lido — é o que produz a sensação de
   "vivo" que o pedido descreve, e é também onde o custo por frame aparece.

Não existe nenhum token de *glow* hoje:

```bash
grep -n "glow\|neon\|accent" public/assets/scss/_color-definitions.scss public/assets/scss/_color.scss
# → 0 resultados
```

Isso é bom: significa que a paleta de luz pode nascer já dentro de `_motion.scss` e do sistema de
níveis da decisão 2.3, em vez de ser retrofitada depois. E o nível `lite` para esta direção não é
"menos brilho" — é **menos camadas de luz**: 3 orbs no `full`, 1 no `lite`, com a malha estática
mantida nos dois, porque ela não custa nada.

### 2.7 O que não fazer

- **Não adicionar bibliotecas que animem por `rAF`.** GSAP (+17,7 %), anime.js (+8,2 %) e Lottie
  escrevem estilo inline a cada frame na thread principal. A exceção medida na decisão 2.5 é
  `motion/mini` (3,08 kB, sobre WAAPI), e só para *stagger* e interrupção com velocidade.
- **Não animar `mix-blend-mode` nem `conic-gradient`.** São o mesmo mecanismo de custo do
  `backdrop-filter`: leitura do que está por baixo, ou re-pintura do gradiente, a cada frame.
- **Não animar `filter` nem `backdrop-filter`.** Já há 4 transições assim
  (`outlet.component.scss:159` · `chapters.component.scss:115,164` ·
  `chapter-comments.component.scss:427`). Cada frame é um re-blur completo. Anima-se a `opacity`
  de um elemento já borrado.
- **Não pôr `will-change` em superfícies novas por hábito.** Cada `will-change` é um layer
  permanente e memória de GPU reservada. Os 4 usos atuais estão certos porque são elementos com
  animação infinita ou de longa duração.
- **Não usar `scroll-timeline`.** Não existe no Safari nem no Firefox estáveis; qualquer
  micro-interação construída sobre ela funciona só num dos três alvos.
- **Não animar entrada de itens de lista em `books` ou `chapters`.** São listas longas com
  `content-visibility: auto`; uma animação de entrada por item força *paint* de tudo o que o
  `content-visibility` acabou de poupar.

---

## 3. Plano de implementação

| Fase | Conteúdo | Esforço |
|---|---|---|
| **F0** | `_motion.scss` com tokens de duração, easing e raio de blur; `@use` em `global.scss` no lugar da secção vazia de `:213`; bloco `prefers-reduced-motion` global | 0,5 d |
| **F1** | `data-fx` no script inline de `index.html`; toggle em `settings.service.ts` + `theme.service.ts`; `_mixins.scss:51-89` a consumir os tokens; **apagar** as 43 linhas de `!important` dos 5 ficheiros | 1–1,5 d |
| **F1b** | `fx-probe.service.ts` (decisão 2.3): sonda de `rAF`, veredito persistido, só degrada | 0,5–1 d |
| **F1c** | Generalizar a opção **G** (decisão 2.4.1): `BlurhashComponent` como camada de fundo onde hoje há `backdrop-filter` sobre capa; aresta de luz + gradiente interno no lugar do filtro | 1–1,5 d |
| **F2** | Guarda `@media (hover: hover) and (pointer: fine)` nas 104 regras `:hover`, em 42 ficheiros; `:active` e `:focus-visible` como o par tátil | 0,5–1 d |
| **F3** | Primitivas de micro-interação: `press` (escala 0,97 no `:active`), `lift` (translateY no hover), *ripple* extraído do `icon-button` para mixin reutilizável | 1,5–2 d |
| **F4** | Revelação por `IntersectionObserver` — já usado em 5 componentes (`books.component.ts`, `info-book.component.ts`, os 3 *readers*); reaproveitar, não reescrever | 1–1,5 d |
| **F5** | Correções da secção 1.5: `scale()` → `translate()` nos 3 ficheiros de orbs; raio de `glass-heavy`; remover as 4 transições de `filter` | 0,5 d |
| **F6** | Direção "luzes noturnas" (decisão 2.6): tokens de *glow* em `_motion.scss`, cena de aurora com contagem de camadas por `data-fx`, tratamento do tema `light`, *glow* nos elementos interativos | 2–3 d |

**Mínimo viável** (o que já entrega a diferença que o pedido descreve): F0 + F1 + F5 ≈ **2–2,5 d**.
**Escopo de engenharia:** F0–F5, incluindo F1b e F1c ≈ **6,5–9,5 d**.
**Com a direção estética:** F0–F6 ≈ **8,5–12,5 d**.

F6 é a única fase cujo esforço **não é dominado por engenharia** — é trabalho de design com
implementação curta, e o intervalo de 2–3 d assume que as duas decisões em aberto da secção 2.6 já
foram tomadas quando a fase começa.

Ordem importa em dois pontos. **F0 antes de tudo**: cada micro-interação escrita antes dos tokens
é uma que terá de ser reescrita. **F2 antes de F3**: acrescentar as primitivas de *hover* de F3 a
104 regras sem guarda de ponteiro multiplica o defeito da secção 1.4 em vez de o conter.

---

## 4. Armadilhas

| Armadilha | Mitigação |
|---|---|
| `backdrop-filter: blur(0px)` ainda cria *stacking context* e camada de composição — não é custo zero | O nível `lite` precisa de `backdrop-filter: none`, não de um token a 0. Regra separada dentro do mixin, sob `[data-fx='lite']` |
| `data-fx` escrito pelo script inline não existe no HTML pré-renderizado (`angular.json:39`, `"prerender": true`) | Mesmo trade-off que `data-theme` já aceita hoje. O default do CSS tem de ser o nível `full`, para o `lite` ser sempre uma subtração |
| `-webkit-backdrop-filter` continua obrigatório para Safari e não pode ser removido ao tocar nos mixins | O mixin já emite os dois (`_mixins.scss:53-57`); manter os dois na reescrita |
| Substituir blur por cor sólida muda o contraste do texto por cima | Usar `color-mix()` com opacidade ≥ 90 %, como o fallback existente já faz (`book-filter.component.scss:504-508`) |
| `--fx-*: 1ms` em vez de `0s` sob reduced-motion | `0s` cancela o evento `transitionend`; código que dependa dele deixa de disparar. `1ms` mantém o evento |
| A sonda mede o arranque a frio e degrada toda a gente | Descartar os 10 primeiros frames e correr **depois** da hidratação, nunca durante |
| A sonda oscila entre `full` e `lite` e produz *flicker* | Só degradar. Promoção apenas na sessão seguinte ou por acção explícita do utilizador |
| O veredito persistido fica preso a uma medição feita num mau momento (bateria fraca, outra aba pesada) | Guardar com data e re-sondar ao fim de N sessões; expor "repor" nas definições |
| Ampliar uma camada de baixa resolução (opção **G**) revela *banding* em gradientes suaves | O `BlurhashComponent` já usa 32–64 px e não mostra o problema em produção; validar caso a caso ao subir a área |
| `transition: all` herda os tokens novos e passa a animar propriedades que antes usavam outro tempo | Não tocar nos 45 `transition: all` em F0. São dívida separada, com risco visual próprio |
| Guardar `:hover` atrás de `@media (hover: hover)` esconde o estado em dispositivos híbridos (Surface, iPad com trackpad) | `(hover: hover) and (pointer: fine)` — é o que `chapters.component.scss:415` já usa |
| *Ripple* com `setTimeout` acumula se o utilizador martelar o botão | O `icon-button` já resolve por `id` incremental (`icon-button.component.ts:55-61`); o mixin extraído tem de manter esse mecanismo |

---

## 5. Verificação

**Automatizável em CI (`npm run lint`, `npm run test:headless`):**

- [ ] `grep -rn "transition:[^;]*[0-9]\+m\?s" src/ --include="*.scss"` → 0 resultados fora de
      `_motion.scss`. O invariante: nenhuma duração literal sobrevive aos tokens.
- [ ] `grep -rn "backdrop-filter" src/ --include="*.scss"` → 0 resultados. Todo vidro passa pelo
      mixin, para que o nível `lite` alcance todas as 27 superfícies e não só 5.
- [ ] `grep -rn "\!important" src/ --include="*.scss" | grep backdrop` → 0 resultados. As 43 linhas
      da secção 1.3 foram apagadas, não acrescentadas.
- [ ] `theme.service.spec.ts` estendido: gravar o nível `lite` escreve `data-fx="lite"` no
      `documentElement` **e** persiste. O teste falha se alguém trocar a persistência por estado
      em memória — que é o que reintroduz o *flash* no arranque.
- [ ] Build de produção continua sem `@angular/animations` no bundle. O teste guarda a decisão 2.5
      contra uma regressão silenciosa por import acidental.
- [ ] Orçamento de *initial transfer* em `angular.json` fixado no valor medido hoje (152,54 kB)
      mais a margem de `motion/mini`. O invariante: nenhuma biblioteca de animação entra sem que
      alguém tenha de subir o número à mão, de forma visível no diff.
- [ ] `grep -rn "mix-blend-mode\|conic-gradient" src/ --include="*.scss"` não cresce além do 1 uso
      atual sem justificação. Guarda a regra da decisão 2.6 contra o caminho fácil do neon.

**Só em dispositivo real — declarado como NÃO verificado até correr:**

- [ ] iPhone com Safari, nível `full`: abrir um modal e confirmar que os 500 ms de `modalAppear`
      não perdem frames com as duas camadas de blur empilhadas (secção 1.3).
- [ ] Android de gama baixa com Firefox: `home` com os dois orbs a animar — confirmar que a troca
      de `scale()` por `translate()` (F5) elimina a re-rasterização de `blur(90px)`.
- [ ] Chromium de gama baixa: comparar `glass-heavy` a 96 px × 24 px. **É esta medição que decide
      se a decisão 2.4-C se sustenta**; sem ela, o ganho é uma afirmação sobre o mecanismo.
- [ ] Qualquer telemóvel: tocar num card e confirmar que o `:hover` não fica colado após F2.
- [ ] Lado a lado, num telemóvel: painel com `backdrop-filter` real × painel com aresta de luz +
      gradiente interno e **sem filtro**. O invariante que isto guarda é a decisão 2.4.1 inteira —
      se a diferença for óbvia, a economia perceptual não existe e a opção **G** cai.
- [ ] A sonda de F1b degrada um aparelho fraco e **não** degrada um rápido, com a página a fazer o
      mesmo trabalho nos dois. Um falso `lite` num portátil rápido invalida a sonda.
- [ ] Comparação visual `full` × `lite` nos 4 pontos de `glass-heavy`, com os 5 temas
      (`dark`, `true-dark`, `light`, `dracula`, `slate`) — o contraste do texto sobre a cor sólida
      muda por tema.

---

## 6. Riscos

1. **A premissa de performance deste relatório não está medida.** Que o blur custa caro nos
   dispositivos alvo é a hipótese do pedido, e é plausível pelo mecanismo — mas nenhum número
   deste documento veio de um *trace*. Se a medição da secção 5 mostrar que o gargalo real está
   noutro sítio, F1 continua a valer pela consolidação das 43 linhas duplicadas, mas o argumento
   de performance cai.
2. **O nível `lite` muda a identidade visual, não só o custo.** O vidro é uma escolha de design
   presente em 27 superfícies. Entregar `lite` sem uma passagem de design entrega uma versão que
   parece partida, não leve. A opção 2.4-F (textura estática) existe para isso e não está
   orçamentada nas fases.
3. **F2 toca 104 regras em dezenas de ficheiros.** É a fase com maior superfície de regressão
   visual e a menos coberta por teste automatizável. Fazê-la em ficheiros pequenos primeiro
   (átomos) e nas páginas depois limita o estrago de cada passo.
4. **A direção estética pode inverter o ganho de F1.** F0–F5 removem custo por frame; F6
   acrescenta luz, que é custo por frame. Se F6 for feita sem a regra da decisão 2.6 — luz pintada
   uma vez, só `opacity` e `transform` a animar — o site acaba mais pesado do que estava antes de
   se remover o blur, e com o argumento de performance já gasto.
5. **Micro-interações são trabalho de design, não de engenharia.** As 3 durações e 2 curvas de
   F0 são uma decisão estética disfarçada de decisão técnica. Se forem escolhidas por
   conveniência, o resultado é consistente e sem carácter — o oposto de "mais vivo".

---

## 7. Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `public/assets/scss/_motion.scss` | **novo** — tokens de duração, easing e raio de blur; bloco global `prefers-reduced-motion` |
| `public/assets/scss/global.scss` | `@use 'motion'` na secção vazia de `:213`; primitivas `press`/`lift` |
| `public/assets/scss/_mixins.scss` | `:51-89` a consumir tokens; `backdrop-filter: none` sob `[data-fx='lite']` |
| `src/index.html` | `data-fx` no bloco inline de `:5-36`, ao lado de `applyTheme` |
| `src/app/core/services/theme.service.ts` | escrita de `data-fx` via `Renderer2`, no molde de `:57-59` |
| `src/app/core/services/settings.service.ts` | persistência da preferência de efeitos |
| `src/app/core/services/theme.service.spec.ts` | testes de `data-fx` (secção 5) |
| `home.component.scss` · `book.component.scss` · `tags.component.scss` · `sensitive-content.component.scss` · `book-filter.component.scss` | **apagados** os 5 blocos `@supports (-moz-appearance: none)` — 43 linhas |
| `home.component.scss:78-88` · `book.component.scss:162-186` · `outlet.component.scss:245-257` | `scale()` → `translate()` nos keyframes dos orbs |
| `outlet.component.scss:159` · `chapters.component.scss:115,164` · `chapter-comments.component.scss:427` | remoção das transições de `filter` |
| `icon-button.component.scss:66-86` | *ripple* extraído para mixin em `_motion.scss` |
| 42 ficheiros `.scss` com `:hover` | guarda `@media (hover: hover) and (pointer: fine)` |
| `public/assets/scss/_motion.scss` | (F6) tokens de *glow*; contagem de camadas de aurora por `data-fx` |
| `home.component.html:2-7` · `outlet.component.html:2-7` · `book.component.html:3-7` | (F6) a cena de aurora passa a componente único em vez de markup repetido 3× |
| `angular.json` | orçamento de *initial transfer* (secção 5) |
| `src/app/core/services/fx-probe.service.ts` | **novo** (F1b) — sonda de `rAF`, veredito persistido, só degrada |
| `src/app/shared/ui/molecules/blurhash/blurhash.component.ts` | (F1c) passa a servir também de camada de fundo, não só de *placeholder* |

---

## 8. O que NÃO foi verificado

- **Nenhuma medição de runtime.** Não houve *trace*, *profile*, Lighthouse ou teste em
  dispositivo. Todo custo de frame neste relatório está marcado `[modelado]` e é uma afirmação
  sobre o mecanismo, não sobre este código a correr.
- **Nenhum dos três alvos foi aberto.** iOS/Safari, Firefox mobile e Chromium de gama baixa são
  citados no pedido e no relatório; a análise correu inteiramente sobre leitura de código em
  Linux.
- **Não foi inspecionado o CSS compilado dos componentes.** O ficheiro global
  (`dist/front/browser/styles-XVNKJDVO.css`, 33.776 bytes, medido) não contém `blur` — todas as
  27 superfícies estão em estilos de componente, que o Angular emite por chunk. A contagem de 27
  vem do fonte SCSS, não do output.
- **A medição das bibliotecas foi feita fora do build do Angular.** Os 3,08 kB do `motion/mini` e
  os 27,03 kB do GSAP vêm de `esbuild --bundle --minify` numa árvore isolada, não de um build real
  desta aplicação. O optimizador do Angular e as dependências partilhadas podem mover esses
  números em qualquer direção; a ordem de grandeza e a comparação entre candidatos são sólidas, o
  valor absoluto dentro do bundle não foi confirmado.
- **`lottie-web` não foi medido.** Está rejeitado pelo mecanismo — rasterização vetorial por frame
  na thread principal — e não por um número. Se alguém quiser defendê-lo, a medição ainda falta.
- **"Corre fora da thread principal" não é garantido em todos os motores.** A vantagem do
  `motion/mini` assenta em a WAAPI delegar `transform`/`opacity` ao compositor. Os três motores
  alvo fazem-no, mas sob condições diferentes (propriedades animadas, presença de layer, tamanho).
  Não foi verificado em nenhum deles.
- **A sonda de `rAF` não foi implementada nem calibrada.** O limiar que separa `full` de `lite`,
  o número de frames e a percentagem a usar são **valores por escolher**, não medidos. O desenho
  da decisão 2.3 está fundamentado; a calibração só existe depois de correr em aparelhos reais.
- **A economia perceptual da decisão 2.4.1 é uma afirmação sobre percepção, não um resultado.**
  Que a aresta de luz vende mais "vidro" do que o desfoque é consistente com a forma como o efeito
  é construído, e com o que `home.component.scss:427-429` já regista num caso — mas ninguém o
  comparou lado a lado neste produto.
- **A direção "luzes noturnas" não foi prototipada.** Nenhuma imagem, nenhum protótipo, nenhuma
  comparação entre os 5 temas. A secção 2.6 diz o que custa caro e o que não custa; **não diz se
  fica bom**, e essa é a pergunta que decide a fase F6.
- **`@angular/animations` não está morto por engano.** A hipótese de que `provideAnimationsAsync()`
  em `app.config.ts:44` esteja a servir o CDK foi verificada e **está refutada**: o pacote não
  aparece em nenhum chunk do build de produção. Fica registado para não voltar a ser levantado.
- **Os 45 `transition: all` não foram auditados um a um.** Sabe-se onde estão e quantos são; não
  se sabe quantos animam propriedades de layout na prática. O relatório de `inputs` já reportou um
  caso concreto (P-01, `margin-top` + `height`) que confirma que pelo menos alguns são reais.
- **O impacto visual do nível `lite` não foi prototipado.** A recomendação 2.4-B assume que cor
  sólida a ≥ 90 % é aceitável em todos os 5 temas. Isso é uma suposição de design por confirmar.

---

> Nenhum item deste relatório foi executado em iOS, Android ou hardware de gama baixa. A única
> coisa efetivamente executada foi um build de produção nesta máquina (`npx ng build
> --configuration production`, exit 0, 5,956 s), usado para provar a ausência de
> `@angular/animations` no bundle e medir o CSS global. Todo o resto vem da leitura do código no
> branch `developer` (commit `912fc3d` mais 3 ficheiros não commitados); a validação em
> dispositivo está listada na secção 5 como pendente.
