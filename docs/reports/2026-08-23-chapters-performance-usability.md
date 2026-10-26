# Análise Técnica — `src/app/pages/chapters`

**Data:** 2026-08-23 · **Branch:** `developer` · **Commit base:** `912fc3d`
**Escopo:** `src/app/pages/chapters/*` (host da experiência de leitura)
**Relatório irmão:** [`2026-08-23-readers-performance-usability.md`](./2026-08-23-readers-performance-usability.md)

---

## 1. Sumário executivo

O `ChaptersComponent` é o orquestrador de toda a experiência de leitura: rota, carregamento
online/offline, persistência de progresso, barra de progresso arrastável, gestos de navegação e
seleção de texto. São 1.111 linhas de TypeScript com 22 serviços injetados num único componente.

Três problemas dominam o resultado e explicam a maior parte do custo percebido:

| # | Problema | Coorte mais afetada | Severidade |
|---|---|---|---|
| P-01 | `cdr.detectChanges()` síncrono em cada tick de scroll (20 Hz) sob `provideZonelessChangeDetection()` | Celular | Alta |
| P-02 | Filtro CSS identidade (`brightness(100%) contrast(100%)`) aplicado sempre, em toda a árvore do capítulo | Celular / Tablet | Alta |
| U-01 | Retomada de leitura **sempre descartada** em capítulos de texto e documento | Todas | Crítica |

Além disso, `@defer` nos três leitores está **anulado** por `@ViewChild` (evidência medida na
secção 3), e a barra de progresso — o principal controlo de navegação intra-capítulo — tem 4 px de
altura em toque, falhando o SC 2.5.8 do WCAG 2.2 por um fator de 6×.

**Veredicto:** funcionalmente rico, mas com um pipeline de scroll que gasta orçamento de frame sem
contrapartida, e com defeitos de usabilidade que quebram o ciclo básico "abrir → ler → voltar
onde parei" para dois dos três tipos de conteúdo.

---

## 2. Metodologia, perfis de cliente e métricas de referência

### 2.1 O que foi feito

- **Análise estática** integral de `chapters.component.{ts,html,scss}` e das suas dependências
  diretas (`SettingsService`, `DEFAULT_SETTINGS`, modelos `Chapter`/`Page`).
- **Build de produção real** executado nesta análise (`npx ng build --configuration production`,
  exit 0, 6,193 s) — os números da secção 3 são **medidos**, não estimados.
- **Inspeção dos chunks emitidos** em `dist/front/browser` para verificar o code-splitting efetivo.

### 2.2 O que NÃO foi feito — limites desta análise

> **Não houve profiling em runtime.** Não foi executado Lighthouse, nem trace de performance, nem
> medição de INP/CLS em dispositivo real. Todos os números de tempo, memória e frames nas secções
> 4 e 5 são **modelos analíticos** derivados de constantes presentes no código (intervalos de
> `throttleTime`, `PAGE_BUFFER`, escalas de canvas, tamanhos de bundle medidos) combinados com as
> condições de rede/CPU normalizadas abaixo. Estão sempre marcados como `[modelado]`.
> Antes de aceitar qualquer correção, os valores devem ser confirmados com medição real.

### 2.3 As três bases de clientes

Perfis normalizados segundo as condições de emulação padrão do Lighthouse e do DevTools, para que
os números sejam reprodutíveis:

| Perfil | Viewport CSS | DPR | CPU | Rede | Memória |
|---|---|---|---|---|---|
| **Celular** (Android médio, classe Moto G Power) | 412 × 823 | 1,75–3 | 4× throttling | Slow 4G: 1.638 Kbps ↓, 150 ms RTT | 4 GB, ~256 MB por aba |
| **Tablet** (iPad 10.9", Safari iOS) | 820 × 1180 | 2 | ~2× throttling | Wi-Fi: 10 Mbps, 40 ms RTT | 4–8 GB, teto de canvas do WebKit |
| **Comutador** (desktop 1080p, Chromium) | 1920 × 1080 | 1 | sem throttling | Cabo: 10 Mbps, 40 ms RTT | ≥ 8 GB |

Nota de layout: `.pages` tem `max-width: 1200px` (`chapters.component.scss:36`), portanto tablet em
paisagem e desktop convergem para o mesmo contentor de 1200 px — isto é relevante para o custo de
rasterização do leitor de documentos.

### 2.4 Métricas de referência (limiares de aprovação)

| Métrica | Limiar "Bom" | Fonte |
|---|---|---|
| LCP (p75) | ≤ 2,5 s | Core Web Vitals |
| INP (p75) | ≤ 200 ms | Core Web Vitals |
| CLS (p75) | ≤ 0,1 | Core Web Vitals |
| Orçamento de frame | 16,7 ms @ 60 Hz (≈ 10 ms de trabalho JS) | RAIL |
| Long task | > 50 ms = violação | RAIL / Lighthouse |
| Bundle inicial | 750 kB aviso / 1,5 MB erro | `angular.json:66-70` (orçamento do próprio projeto) |
| Estilo por componente | 20 kB aviso / 30 kB erro | `angular.json:71-75` |
| Alvo de toque | ≥ 24 × 24 px CSS | WCAG 2.2 SC 2.5.8 (AA) |
| Teclado | toda a funcionalidade operável | WCAG 2.2 SC 2.1.1 (A) |
| Nome/Função/Valor | controlos com role e estado expostos | WCAG 2.2 SC 4.1.2 (A) |

Os dois últimos são exigências do próprio projeto: `docs/guidelines/angular-architecture-best-practices.md`
determina conformidade **WCAG AA** e aprovação em checagens AXE.

---

## 3. Evidências medidas (build de produção, 2026-08-23)

### 3.1 Orçamento de bundle

| Item | Raw | Transferência |
|---|---|---|
| **Total inicial** | 564,55 kB | **152,54 kB** |
| `chapters-component` (chunk de rota) | 36,79 kB | 9,37 kB |
| Dependência estática `chunk-HNNCZO6D` (contém `mqtt`) | 381,71 kB | 97,56 kB |
| Dependência estática `chunk-IJWPDYQA` | 90,11 kB | 15,48 kB |
| Dependência estática `chunk-RU3FHTZB` | 64,56 kB | 15,02 kB |
| `pdf-page-component` (import dinâmico — corretamente lazy) | 495,61 kB | 122,66 kB |
| Total de JS do browser em `dist/front/browser` | 3,74 MB | — |

O inicial consome **75,3 %** do orçamento de aviso de 750 kB definido pelo próprio projeto. Não é
uma violação, mas não há folga para crescer.

### 3.2 `@defer` dos leitores está anulado — verificado no bundle

O template usa `@defer (on immediate)` nos três leitores
(`chapters.component.html:72,84,95`), o que deveria produzir um chunk por leitor. O chunk emitido
`chunk-IZTFQO5G.js` (`chapters-component`) **contém os três seletores** `app-text-reader`,
`app-image-reader` e `app-document-reader`, e declara **um único** `import()` dinâmico.

Causa: os três `@ViewChild` em `chapters.component.ts:141-144` referenciam as classes ao nível do
TypeScript. O compilador do Angular só converte um import em *deferrable* quando o símbolo é usado
**exclusivamente** dentro de blocos `@defer`; uma referência em código anula a otimização.

**Consequência por coorte:** um capítulo de imagens — o caso maioritário — transfere também o
código do leitor de texto e do leitor de documentos. O impacto direto em bytes é modesto (o
chunk inteiro são 9,37 kB transferidos), mas o padrão é enganador: a equipa acredita ter três
chunks e tem um. Quando o leitor de texto crescer, o custo vai para todos.

**Correção:** substituir os três `@ViewChild` de classe por *template reference variables*
(`@ViewChild('imageReaderRef')`) ou por uma interface comum injetada, e reconfirmar no bundle que
passam a existir três chunks.
**Critério de aceite:** `grep -l "app-text-reader" dist/front/browser/*.js` devolve um chunk
diferente do `chapters-component`.

---

## 4. Achados de performance

### P-01 · `detectChanges()` síncrono a 20 Hz durante o scroll — **Alta**

`chapters.component.ts:293-330`

```ts
this.ngZone.runOutsideAngular(() => {
  fromEvent(window, 'scroll').pipe(throttleTime(50, ...))
    .subscribe(() => {
      ...
      this.showScrollToTopButton.set(isScrolledDown && isScrollingUp);
      this.lastScrollPosition = currentScroll;
      this.cdr.detectChanges(); // linha 323
    });
});
```

Dois defeitos sobrepostos:

1. **`runOutsideAngular` é inócuo.** A aplicação usa `provideZonelessChangeDetection()`
   (`app.config.ts:33`). Não há Zone a evitar. O comentário na linha 323 justifica o
   `detectChanges()` com "estamos fora do NgZone" — a premissa é falsa.
2. **`detectChanges()` é redundante e síncrono.** `showScrollToTopButton` é um `signal`; escrevê-lo
   já agenda deteção de mudanças. O `detectChanges()` força um ciclo **síncrono** sobre a view e
   todas as suas descendentes — o que inclui a árvore inteira do leitor ativo — **a cada tick, mesmo
   quando nada mudou** (o caso comum: o utilizador rola para baixo e o booleano permanece `false`).

**Custo [modelado]:** 20 ciclos de CD/s durante todo o scroll. Num capítulo de imagens com 40
páginas, cada ciclo reavalia as ligações de cada contentor de página, incluindo duas chamadas de
função por página no template do leitor de imagens (ver P-06 no relatório irmão) — ≈ 1.600
invocações de função por segundo apenas para confirmar que nada mudou.

| Coorte | Impacto |
|---|---|
| Celular | Alto. Com 4× de throttling, cada ciclo compete diretamente com o orçamento de 10 ms/frame; é a fonte mais provável de INP acima de 200 ms ao tocar em controlos durante o scroll. |
| Tablet | Médio. |
| Comutador | Baixo — mascarado pela CPU. |

**Correção:** remover a linha 323 e o `runOutsideAngular` envolvente; deixar o sinal agendar o CD.
Opcionalmente elevar o `throttleTime` para 100 ms, já que o alvo é apenas mostrar/esconder um botão.
**Critério de aceite:** trace de scroll de 5 s num capítulo de 40 páginas sem long tasks (> 50 ms) e
com ≤ 1 ciclo de CD por frame.

---

### P-02 · Filtro CSS identidade aplicado a todos os utilizadores — **Alta**

`chapters.component.ts:174-196` + `chapters.component.html:65`

```ts
if (s.brightness != null) parts.push(`brightness(${s.brightness}%)`);
if (s.contrast   != null) parts.push(`contrast(${s.contrast}%)`);
```

`DEFAULT_SETTINGS` (`src/app/core/models/settings.models.ts:41-42`) define `brightness: 100` e
`contrast: 100`. A guarda é `!= null`, não "é diferente do neutro". Resultado: **todo o utilizador,
por omissão, recebe `filter: brightness(100%) contrast(100%)`** em `.chapter-content` — um filtro que
não produz efeito visual nenhum.

Um `filter` diferente de `none` cria um *containing block* e uma camada de compositing própria, e
obriga o browser a rasterizar a subárvore por esse caminho. A subárvore aqui é o capítulo inteiro
— dezenas de milhares de pixels de altura num capítulo de imagens.

| Coorte | Impacto [modelado] |
|---|---|
| Celular | Alto. GPUs móveis re-rasterizam tiles ao rolar sobre uma camada filtrada; é custo puro, sem qualquer benefício visual. |
| Tablet | Médio-alto (mesma classe de GPU, viewport maior). |
| Comutador | Baixo. |

**Correção:** só empurrar a parte do filtro que difere do neutro.

```ts
if (s.brightness != null && s.brightness !== 100) parts.push(...);
if (s.contrast   != null && s.contrast   !== 100) parts.push(...);
```

**Critério de aceite:** com as definições por omissão, o DOM inspecionado mostra
`filter: none` em `.chapter-content`.

**Nota relacionada:** o mesmo `computed` adiciona `blur(40px)` quando a privacidade ativa
(`chapters.component.ts:189`). Um blur de raio 40 px sobre um elemento de altura total é dos
efeitos mais caros disponíveis em CSS. Como só ocorre num estado excecional (app oculta/inativa),
fica classificado como aceitável — mas convém confirmar que o `filter` é removido, e não apenas
reduzido, ao voltar ao estado normal.

---

### P-03 · Três listeners de scroll concorrentes na mesma janela — **Média**

Nenhum destes componentes sabe dos outros. Por tipo de conteúdo, o número de handlers executados
por segundo de scroll [modelado, derivado dos `throttleTime` no código]:

| Tipo de capítulo | `chapters` (50 ms) | Leitor | Total/s | Layouts forçados/s |
|---|---|---|---|---|
| Imagem | 20 | image-reader, 100 ms → 10 | **30** | 10 (`scrollHeight`) |
| Texto | 20 | text-reader, 20 ms → 50 | **70** | 50 (`getBoundingClientRect`) |
| Documento | 20 | document-reader, 20 ms → 50 | **70** | 50 + 10 (debounce de 100 ms) |

A 60 Hz existem 60 frames por segundo. Em capítulos de texto e documento, ≈ 83 % dos frames
carregam pelo menos um *forced synchronous layout*. Detalhe dos leitores no relatório irmão
(P-01 a P-03).

**Correção estrutural:** um único serviço de scroll (`ScrollProgressService`) que lê a posição uma
vez por frame com `requestAnimationFrame`, expõe um sinal, e é consumido por host e leitor. Elimina
a duplicação e converte N leituras de layout por frame em uma.
**Critério de aceite:** um único listener de `scroll` registado na `window` na aba de Event
Listeners do DevTools, para qualquer tipo de capítulo.

---

### P-04 · `URL.createObjectURL` do documento offline nunca é revogado — **Média**

`chapters.component.ts:625`

```ts
documentPath: offlineChapter.document
  ? URL.createObjectURL(offlineChapter.document)  // nunca entra em pageObjectUrls
  : undefined,
```

O `ngOnDestroy` (`:347-353`) revoga apenas os URLs em `pageObjectUrls`, e o `loadOfflineChapter`
(`:596-599`) também só limpa esse array. O blob do PDF fica retido pelo tempo de vida do documento.

**Custo:** um PDF offline típico de 5–20 MB permanece em memória por capítulo aberto. Navegar por
10 capítulos descarregados numa sessão retém potencialmente 50–200 MB.

| Coorte | Impacto |
|---|---|
| Celular | Alto — é o perfil que mais usa modo offline e o que tem menos margem antes de o browser descartar a aba. |
| Tablet | Médio. |
| Comutador | Baixo. |

**Correção:** empurrar o URL do documento para `pageObjectUrls` (renomeando para `objectUrls`).
**Critério de aceite:** teste unitário que abre e destrói o componente com um capítulo offline de
documento e verifica a chamada a `URL.revokeObjectURL` com esse URL.

---

### P-05 · MQTT (97,56 kB transferidos) no caminho crítico da rota — **Média**

`chunk-HNNCZO6D` (381,71 kB raw / 97,56 kB transferidos, contém o cliente `mqtt`) é importado
**estaticamente** pelo chunk da rota de capítulos. O `setupWebSocket` (`:355-402`) só é invocado
quando existe token de acesso válido — mas o download acontece sempre.

**Custo [modelado]:** em Slow 4G a ~200 kB/s efetivos, 97,56 kB ≈ **0,49 s** adicionais no caminho
até ao primeiro pixel do capítulo, para um leitor não autenticado que nunca vai usar MQTT.

**Correção:** carregar o `MqttService` por `import()` dinâmico dentro de `setupWebSocket`, atrás da
guarda de autenticação que já existe.
**Critério de aceite:** o chunk que contém `mqtt` deixa de aparecer nos imports estáticos do chunk
`chapters-component`.

---

### P-06 · Rota sem SSR de dados — LCP inteiramente dependente do cliente — **Média**

Todo o carregamento está atrás de `isPlatformBrowser` (`:233`), com um comentário a explicar que o
SSR não alcança `localhost:3000` em Docker. A consequência é que o SSR entrega apenas o placeholder
de blurhash (`chapters.component.html:139-153`) e a cadeia real começa no cliente.

Cadeia crítica modelada para o perfil **Celular** (Slow 4G, 4× CPU):

| Etapa | Custo [modelado] |
|---|---|
| HTML + bundle inicial (152,54 kB) + RTTs de ligação | ~1,2 s |
| Parse/execução de 564 kB raw de JS a 4× | ~0,5–0,6 s |
| Chunk da rota + deps estáticas (~137 kB) | ~0,7 s |
| `GET /chapter/:id` (1 RTT + servidor) | ~0,3 s |
| Primeira imagem (~250 kB, sem `srcset` — ver relatório irmão U-03) | ~1,25 s |
| **LCP estimado** | **≈ 4,0–4,5 s** |

Contra o limiar de 2,5 s, o perfil celular fica na faixa "Precisa de melhorias"/"Ruim". Comutador e
tablet, pelo mesmo modelo, ficam em ≈ 1,0–1,4 s e ≈ 1,5–2,0 s respetivamente — dentro do limiar.

O ganho maior aqui não está no SSR (o bloqueio de rede em Docker é real e legítimo) mas em P-05 e
na negociação de imagem responsiva descrita no relatório irmão. **Este item precisa de medição real
antes de qualquer ação** — é o ponto do relatório com maior margem de erro.

---

### P-07 · `PreloadAllModules` compete com o conteúdo do capítulo — **Baixa** (fora de escopo, registado)

`app.config.ts:38` ativa `withPreloading(PreloadAllModules)`. Após o bootstrap, o browser começa a
descarregar todos os chunks de rota — de um total de 3,74 MB de JS no diretório de build. Em Slow
4G isto disputa largura de banda com as imagens do capítulo, exatamente na janela em que o
utilizador está à espera de ler.

Não é um defeito do módulo `chapters`, mas é o módulo que mais sofre com ele. Alternativa:
`QuicklinkStrategy` ou uma estratégia própria que só pré-carrega em `navigator.connection.effectiveType === '4g'`
e com `saveData === false`.

---

## 5. Achados de usabilidade e acessibilidade

### U-01 · Retomada de leitura sempre descartada em texto e documento — **Crítica**

`chapters.component.ts:798-812`

```ts
const totalPages     = currentChapter.pages?.length || 0;
const savedPageIndex = progress?.pageIndex || 0;

const isLastPage      = savedPageIndex >= totalPages - 1;   // linha 808
const targetPageIndex = isLastPage ? 0 : savedPageIndex;    // linha 809
```

Em capítulos de **texto** e **documento**, `pages` está vazio → `totalPages = 0` →
`savedPageIndex >= -1` é **verdadeiro para qualquer progresso guardado** → `targetPageIndex = 0`.

O utilizador que lê 80 % de um capítulo de texto ou de um PDF de 300 páginas, sai, e volta,
**recomeça sempre do início**. O progresso está a ser guardado corretamente
(`updateProgressState`, `:638-661`) — apenas é deitado fora na restauração.

A intenção da regra é razoável (quem terminou o capítulo deve reabrir no início), mas está expressa
em termos de uma contagem que só existe para conteúdo de imagem.

**Correção:** obter o total do leitor ativo em vez de `pages.length`, e tratar `totalPages === 0`
como "desconhecido — restaurar o que estiver guardado":

```ts
const totalPages = currentChapter.pages?.length
  || this.documentReader?.getTotalPages()
  || this.textReader?.getVirtualPages()
  || 0;
const isLastPage = totalPages > 0 && savedPageIndex >= totalPages - 1;
```

**Critério de aceite (Regra 9 — o teste tem de poder falhar quando a regra de negócio muda):** três
testes, um por tipo de conteúdo, que guardam progresso a 50 %, remontam o componente e afirmam que
a posição restaurada é 50 % e não 0.

---

### U-02 · Percentagem inicial de texto usa uma constante mágica errada — **Alta**

`chapters.component.html:75-77`

```html
[initialScrollPercentage]="savedPageIndex() > 0 ? (savedPageIndex() / 10) * 100 : 0"
```

O `10` assume que qualquer capítulo de texto tem 10 páginas virtuais. O leitor de texto calcula-as
como `ceil(palavras / 300)` (`text-reader.component.ts:36,150`). Para um capítulo de 9.000 palavras
são 30 páginas — a fórmula produz 3× a percentagem correta e satura em 100 % a partir da página 10.

Atualmente este defeito está encoberto por U-01 (que força `savedPageIndex` a 0). **Corrigir U-01
sem corrigir U-02 torna o bug visível**, o que faz destes dois itens uma única unidade de trabalho.

**Correção:** passar o índice de página guardado e deixar o leitor converter, ou expor a percentagem
diretamente no serviço de progresso.

---

### U-03 · Barra de progresso: 4 px de alvo, sem teclado, sem semântica — **Alta**

`chapters.component.html:41-61` + `chapters.component.scss:169-236`

```scss
.reading-progress-bar {
  height: 4px;
  touch-action: none;
  &:hover { height: 40px; }   // :hover nunca dispara em toque
}
```

É o controlo principal de navegação dentro do capítulo, e acumula três violações:

| Problema | Norma | Coorte |
|---|---|---|
| Alvo de arrasto com 4 px de altura; expande para 40 px só em `:hover` | **WCAG 2.2 SC 2.5.8** exige ≥ 24 px — falha por 6× | Celular, Tablet |
| `<div>` com `mousedown`/`touchstart`, sem `role`, sem `aria-valuenow` | **WCAG 2.2 SC 4.1.2** (A) | Leitores de ecrã |
| Nenhum handler de teclado no ficheiro (confirmado: zero ocorrências de `keydown`/`keyup`) | **WCAG 2.2 SC 2.1.1** (A) | Comutador |

Os `<span>` numerados dentro da barra (um por página) têm `color: transparent` e só se tornam
visíveis no estado `:hover` de 40 px — ou seja, o único afford­ance que indica "isto é arrastável e
tem páginas" é inalcançável em toque, que é a coorte maioritária de leitura.

**Correção:** `role="slider"` com `aria-valuemin/max/now/text`, `tabindex="0"`, handlers de
`ArrowLeft`/`ArrowRight`/`Home`/`End`, e uma área de toque de ≥ 24 px conseguida com um
pseudo-elemento invisível (`::before` com `inset: -12px 0`) em vez de crescer o elemento visível.
**Critério de aceite:** AXE sem violações na página do capítulo; navegação completa do capítulo
apenas com teclado.

---

### U-04 · Duplo clique navega para o capítulo seguinte e colide com a seleção de texto — **Alta**

`chapters.component.ts:1027-1041`

```ts
const rect = host.getBoundingClientRect();
const clickY = event.clientY - rect.top;
const triggerZoneStart = rect.height * 0.3;   // 30% da ALTURA TOTAL do capítulo
if (clickY >= triggerZoneStart) this.nextPage();
```

`rect` é o contentor `.pages` inteiro — não o viewport. Num capítulo de 30.000 px de altura, a
"zona de gatilho" começa aos 9.000 px e cobre os restantes 70 % **de todo o capítulo**. Na prática:
qualquer duplo clique abaixo do primeiro terço do capítulo salta para o capítulo seguinte.

O conflito é direto e grave no perfil **Comutador**: duplo clique é o gesto universal para
selecionar uma palavra, e este mesmo componente constrói realces a partir da seleção
(`onTextSelection`, `:685`). O utilizador que tenta selecionar uma palavra num capítulo de
texto perde o lugar e vai para o capítulo seguinte.

**Correção:** medir contra o viewport (`event.clientY >= window.innerHeight * 0.3`), e desativar o
gesto por completo em capítulos de texto, onde a seleção é uma interação de primeira classe.
**Critério de aceite:** duplo clique numa palavra de um capítulo de texto seleciona a palavra e não
navega.

---

### U-05 · `.next-chapter-zone` bloqueia o menu de contexto em toque — **Média**

`chapters.component.scss:405-420`

```scss
.next-chapter-zone { position: absolute; bottom: 0; height: 70vh; z-index: 5; }
@media (hover: hover) and (pointer: fine) {
  .next-chapter-zone { pointer-events: none; }   // só desativada em rato
}
```

Em celular e tablet a zona permanece ativa e cobre os últimos 70 vh do capítulo. As ações de
`onContextMenu` — "Baixar Página" e "Salvar Página" (`:946`) — dependem de long-press sobre a
imagem. Nas últimas páginas do capítulo, o long-press atinge a zona e não a imagem: **as duas ações
são inalcançáveis exatamente onde o leitor mais provavelmente quer guardar a página final.**

Além disso a zona não define `touch-action`, pelo que o duplo toque que a aciona
(`onZoneTouch`, `:1014-1025`) pode competir com o duplo toque de zoom nativo do browser.

**Correção:** reduzir a zona para uma faixa de altura fixa ancorada ao viewport (ex.: 120 px no
fundo do ecrã) e dar-lhe `touch-action: manipulation`.

---

### U-06 · Controlos não focáveis por teclado — **Média** (WCAG 2.1.1, nível A)

Confirmado por inspeção: **nenhum** handler de teclado em todo o componente.

| Elemento | Local | Problema |
|---|---|---|
| `<a class="index">` | `html:15`, `:181` | `<a>` sem `href` → fora da ordem de tabulação |
| `<a class="next">` | `html:128`, `:133` | idem — é o botão "Próximo capítulo" do rodapé |
| `<a class="arrow">` (aside) | `html:177`, `:187` | idem |
| `<div class="btn-top">` | `html:117-125` | `<div>` com `aria-label` e `(click)`, sem `role` nem `tabindex` |

O `aria-label` num `<div>` sem `role` não cria um controlo: anuncia um nome para algo que a
tecnologia assistiva continua a tratar como texto.

Para o perfil **Comutador** o efeito prático é que a navegação entre capítulos exige rato. Não
existe atalho de teclado (`←`/`→`, `PageUp`/`PageDown`) — um padrão que qualquer leitor concorrente
oferece.

**Correção:** trocar `<a>` sem `href` por `<button type="button">` (já existe `app-button` no
projeto e está a ser usado no cabeçalho — a inconsistência é interna), dar `role="button"` +
`tabindex="0"` ao `.btn-top`, e adicionar um `@HostListener('document:keydown')` para setas.

---

### U-07 · Realce de seleção registado em duplicado — **Baixa**

`chapters.component.ts:685-691` cria um realce em `mouseup`/`touchend` sobre `.pages`; o
`TextReaderComponent` cria outro em `selectionchange` com throttle de 200 ms
(`text-reader.component.ts:166-180`). Em capítulos de texto ambos disparam para a mesma seleção,
com o mesmo id `'reading-selection'`. Trabalho duplicado e risco de cintilação visual.

**Correção:** manter apenas o listener do leitor de texto (é o único contexto onde a seleção faz
sentido) e remover os bindings `(mouseup)`/`(touchend)` do host.

---

### U-08 · Imagem que falha desaparece em silêncio — **Baixa**

A `ImageFallbackDirective` (`src/app/shared/ui/directives/image-fallback.directive.ts`) resolve o
erro com `style.display = 'none'`. Não há retry, nem indicação, nem telemetria. O leitor vê o
blurhash indefinidamente e não tem como distinguir "a carregar" de "falhou".

Em Slow 4G, onde timeouts de imagem são comuns, esta é a diferença entre "a app é lenta" e "a app
está avariada". **Correção:** estado de erro visível com botão de recarregar a página individual.

---

### U-09 · Sem `prefers-reduced-motion` — **Baixa**

O projeto já respeita esta media query em cinco outros ficheiros (`login`, `book`, `outlet`,
`register`, `home`) e tem um mixin em `public/assets/scss/_mixins.scss:27`. O `chapters.component.scss`
não a implementa, apesar de ter transições em `filter` (`:164`), `height`/`top` da barra (`:185-187`)
e `transform` do botão de topo.

É uma quebra de convenção interna do projeto, não apenas uma omissão de acessibilidade.

---

### U-10 · Código morto — **Baixa**

Verificado por grep contra o template:

| Símbolo | Local |
|---|---|
| `unblur()` | `ts:681` — não referenciado no template |
| `clearHighlights()` | `ts:692` — idem |
| `getContentType()` | `ts:696` — idem |
| `.shortcuts-mobile-pages`, `.next-chapter`, `.last-chapter` | `scss:293-311` — classes inexistentes no template |
| `ngAfterViewInit` | `ts:289` — corpo é apenas um early-return |

O projeto usa Knip (`npm run check:dead-code`) precisamente para isto; vale correr sobre este
ficheiro.

---

## 6. Backlog priorizado

Ordenado por (impacto no utilizador × número de coortes afetadas) ÷ esforço.

| Pri | Item | Esforço | Coortes | Tipo |
|---|---|---|---|---|
| 1 | **U-01 + U-02** — retomada de leitura em texto/documento (unidade única) | M | Todas | Correção |
| 2 | **P-01** — remover `detectChanges()` e `runOutsideAngular` do scroll | XS | Celular, Tablet | Perf |
| 3 | **P-02** — não emitir filtro identidade | XS | Celular, Tablet | Perf |
| 4 | **U-04** — duplo clique medido contra o viewport; desativar em texto | S | Comutador | UX |
| 5 | **U-03** — barra de progresso: alvo 24 px, `role="slider"`, teclado | M | Todas | A11y |
| 6 | **U-06** — controlos focáveis + atalhos de seta | S | Comutador | A11y |
| 7 | **P-04** — revogar o object URL do documento offline | XS | Celular | Perf |
| 8 | **U-05** — reduzir `.next-chapter-zone` ao viewport | S | Celular, Tablet | UX |
| 9 | **P-05** — MQTT por import dinâmico | S | Celular | Perf |
| 10 | **P-03** — unificar o pipeline de scroll num serviço | L | Celular, Tablet | Perf |
| 11 | **§3.2** — restaurar o `@defer` dos leitores | S | Todas | Perf |
| 12 | U-07 a U-10 — limpeza | S | — | Qualidade |

Os itens 2, 3 e 7 somam menos de uma hora de trabalho e cobrem os dois maiores custos de runtime
identificados. São o ponto de partida natural.

---

## 7. Riscos e o que falta verificar

1. **Nenhum número de tempo neste relatório foi medido.** Antes de aceitar as correções de
   performance, executar um trace do DevTools sobre um capítulo de 40 páginas nos três perfis e
   registar INP, CLS e long tasks. O modelo de LCP em P-06 é o item de maior incerteza.
2. **Cabeçalhos de cache das imagens não foram inspecionados.** O custo do descarregamento de
   imagens (relatório irmão, P-04) depende inteiramente disso.
3. **Não foi verificado se a API suporta variantes de imagem** (`?w=`, thumbnails). A recomendação
   de `srcset` no relatório irmão pressupõe que sim ou que se pode adicionar.
4. **U-01 tem de ser corrigido junto com U-02.** Corrigir só o primeiro expõe o segundo.
