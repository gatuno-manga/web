# Análise Técnica — `src/app/features/reading/components/readers`

**Data:** 2026-08-23 · **Branch:** `developer` · **Commit base:** `912fc3d`
**Escopo:** `image-reader`, `text-reader`, `document-reader` (+ `pdf-page`), `reader-settings-form`
**Relatório irmão:** [`2026-08-23-chapters-performance-usability.md`](./2026-08-23-chapters-performance-usability.md)

---

## 1. Sumário executivo

Quatro componentes, 3.087 linhas, três estratégias de virtualização diferentes — e nenhuma delas
partilha código com as outras. Os três leitores reimplementam, cada um à sua maneira, o mesmo
conjunto de responsabilidades: listener de scroll, cálculo de progresso, `IntersectionObserver`,
`scrollToPage`, `resetProgress`. As divergências entre as três implementações são a origem da
maioria dos achados.

Os problemas dominantes:

| # | Problema | Coorte mais afetada | Severidade |
|---|---|---|---|
| P-05 | Virtualização do PDF baseada numa altura fixa de 1200 px — desalinha após ~2 páginas | Todas | Crítica |
| P-06 | Canvas de PDF: ~117 MB residentes em desktop/tablet; renderização a 0,5× da resolução física em celular | Celular / Tablet | Alta |
| P-04 | Imagens sem `srcset`: o celular descarrega a resolução de desktop | Celular | Alta |
| P-07 | Colapso de layout ao descarregar imagens sem metadata (CLS ≈ 1,0) | Todas | Alta |

**Veredicto:** o leitor de imagens é o mais maduro dos três e está perto de bom — falta-lhe
negociação de imagem responsiva e uma correção de reserva de espaço. O leitor de documentos tem um
modelo de virtualização que não sobrevive ao contacto com PDFs reais. O leitor de texto é o mais
leve, mas carrega um `IntersectionObserver` que não faz absolutamente nada.

---

## 2. Metodologia, perfis de cliente e métricas de referência

### 2.1 O que foi feito

- Análise estática integral dos quatro componentes e dos respetivos templates e estilos.
- Build de produção real (`npx ng build --configuration production`, exit 0) — os tamanhos de
  bundle na secção 3 são **medidos**.
- Aritmética exata sobre as constantes do código (`PAGE_BUFFER`, `ESTIMATED_PAGE_HEIGHT`,
  `WORDS_PER_PAGE`, escala de rasterização do canvas) para derivar custos de memória e de frame.

### 2.2 Limites — leia antes de agir sobre os números

> **Não houve profiling em runtime.** Não foi executado Lighthouse, trace de performance, nem
> heap snapshot. Os valores de memória, frames e tempo estão marcados `[modelado]` e resultam de
> cálculo direto sobre constantes do código aplicadas aos perfis abaixo. São ordens de grandeza
> defensáveis, não medições. Confirmar antes de aceitar qualquer correção.

### 2.3 As três bases de clientes

| Perfil | Viewport CSS | DPR | Largura efetiva do leitor* | CPU | Rede |
|---|---|---|---|---|---|
| **Celular** (Android médio) | 412 × 823 | 1,75–3 | 412 px | 4× throttling | Slow 4G: 1.638 Kbps, 150 ms RTT |
| **Tablet** (iPad 10.9", Safari) | 820 × 1180 | 2 | 820 px (retrato) / 1200 px (paisagem, com teto) | ~2× | Wi-Fi 10 Mbps, 40 ms |
| **Comutador** (1080p, Chromium) | 1920 × 1080 | 1 | 1200 px (teto) | — | Cabo 10 Mbps, 40 ms |

\* Os leitores são renderizados dentro de `.pages`, que tem `max-width: 1200px`
(`pages/chapters/chapters.component.scss:36`). Desktop e tablet em paisagem convergem para 1200 px —
o que faz com que ambos paguem o custo máximo de rasterização de PDF descrito em P-06.

### 2.4 Métricas de referência

| Métrica | Limiar | Fonte |
|---|---|---|
| LCP (p75) | ≤ 2,5 s | Core Web Vitals |
| INP (p75) | ≤ 200 ms | Core Web Vitals |
| CLS (p75) | ≤ 0,1 | Core Web Vitals |
| Orçamento de frame | 16,7 ms @ 60 Hz | RAIL |
| Long task | > 50 ms | RAIL |
| Memória de canvas por aba (WebKit iOS) | ~256 MB antes de descarte da página | Limite prático do WebKit |
| Alvo de toque | ≥ 24 × 24 px CSS | WCAG 2.2 SC 2.5.8 (AA) |
| Contraste de texto | ≥ 4,5:1 | WCAG 2.2 SC 1.4.3 (AA) |

Conformidade WCAG AA e aprovação AXE são requisitos declarados em
`docs/guidelines/angular-architecture-best-practices.md`.

---

## 3. Evidências medidas (build de produção)

| Chunk | Raw | Transferência | Nota |
|---|---|---|---|
| `pdf-page-component` | 495,61 kB | **122,66 kB** | Import dinâmico correto (`document-reader.component.ts:206-208`) |
| `chapters-component` (contém os 3 leitores) | 36,79 kB | 9,37 kB | Ver §3.2 |
| Total inicial da app | 564,55 kB | 152,54 kB | 75 % do orçamento de aviso do projeto |

### 3.1 O import dinâmico do PDF está bem feito

```ts
const { PdfPageComponent } = await import('./pdf-page/pdf-page.component');
```

Os 122,66 kB transferidos do `pdf.js` só chegam ao cliente quando o capítulo é de facto um
documento. **É o melhor exemplo de lazy loading do módulo** — em Slow 4G isto poupa ~0,6 s a todos
os leitores de mangá e de texto. Registado aqui como padrão a replicar.

### 3.2 Mas os três leitores partilham um único chunk

Verificado no bundle: `chunk-IZTFQO5G.js` contém os seletores `app-image-reader`,
`app-text-reader` e `app-document-reader`. O `@defer (on immediate)` do host está anulado pelos
`@ViewChild` de classe. Análise completa em §3.2 do relatório irmão — a correção pertence ao host,
mas o efeito sente-se aqui.

---

## 4. Achados de performance

### P-01 · `image-reader`: leitura de layout forçada a 10 Hz — **Média**

`image-reader.component.ts:97-127`

```ts
const documentHeight = document.documentElement.scrollHeight;  // força layout síncrono
```

`scrollHeight` é uma propriedade que obriga o browser a resolver o layout pendente antes de
responder. A 10 Hz durante todo o scroll, num documento cuja altura é de dezenas de milhares de
pixels, é uma leitura barata individualmente mas sistematicamente mal colocada: acontece no meio do
handler de scroll, exatamente onde o browser ainda tem estilos por aplicar.

**Custo [modelado]:** 10 layouts forçados/s. Somado aos 20 ciclos de CD/s do host (P-01 do relatório
irmão), o perfil **Celular** a 4× de throttling gasta uma fatia mensurável do orçamento de 10 ms por
frame sem produzir pixel nenhum.

**Correção:** cachear `scrollHeight` e invalidar em `ResizeObserver` do contentor, ou obter a
percentagem a partir do `IntersectionObserver` que já existe.

---

### P-02 · `text-reader`: `getBoundingClientRect()` a 50 Hz — **Alta**

`text-reader.component.ts:154-163` e `:225-245`

```ts
throttleTime(20, ...)   // 50 execuções por segundo
...
const rect = container.getBoundingClientRect();  // layout forçado, em cada uma
```

50 Hz é mais rápido do que a taxa de refrescamento útil: a 60 Hz há 60 frames/s, portanto ≈ 83 %
dos frames carregam um *forced synchronous layout*. E o resultado é usado apenas para desenhar uma
barra de progresso de 4 px.

Agrava-se com a condição de emissão em `emitProgress` (`:248-273`):

```ts
if (clampedPage !== this.lastReportedPage ||
    Math.abs(scrollPercentage - (this.lastReportedPage / this.virtualPages()) * 100) > 1)
```

O segundo termo compara uma **percentagem** (0–100) com um **rácio de páginas** (`lastReportedPage /
virtualPages`, que dá 0–1). As unidades não batem certo: para qualquer `scrollPercentage` acima de
~1 %, a diferença excede 1 e a condição é sempre verdadeira. Na prática **a guarda não filtra nada**
— há 50 emissões por segundo, cada uma a escrever um sinal no host e a agendar deteção de mudanças.

**Correção:** `throttleTime(100)` (suficiente para uma barra de progresso), ler a posição via
`requestAnimationFrame`, e corrigir a comparação para usar as mesmas unidades:

```ts
const lastPercentage = (this.lastReportedPage / this.virtualPages()) * 100;
if (clampedPage !== this.lastReportedPage || Math.abs(scrollPercentage - lastPercentage) > 1)
```

**Critério de aceite:** trace de 5 s de scroll num capítulo de texto de 10.000 palavras com zero
long tasks e ≤ 10 emissões de `progressChange` por segundo.

---

### P-03 · `text-reader`: `IntersectionObserver` que não faz nada — **Média**

`text-reader.component.ts:184-221`

```ts
const elements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre');
...
this.intersectionObserver = new IntersectionObserver((entries) => {
  let bestEntry = null;
  for (const entry of entries) { /* escolhe o melhor */ }
  if (bestEntry) {
    // No logic needed here yet, just identifying best entry
  }
}, options);
for (const el of Array.from(elements)) this.intersectionObserver?.observe(el);
```

Um capítulo de 10.000 palavras tem tipicamente 150–250 elementos de bloco. São 150–250 alvos
observados, com o browser a calcular intersecções em cada mudança de scroll, para invocar um
callback que percorre as entradas e **descarta o resultado**.

**Custo [modelado]:** trabalho de intersecção proporcional a N elementos, contínuo durante toda a
leitura, com valor de utilizador zero. No perfil **Celular** este é o custo mais fácil de eliminar
de todo o módulo — é apagar código.

**Correção:** remover `setupIntersectionObserver` e a chamada em `ngOnInit:111`. Se o objetivo era
progresso por parágrafo, implementar de facto — mas então substitui o listener de scroll de P-02,
não acumula com ele.

---

### P-04 · `image-reader`: sem negociação de imagem responsiva — **Alta**

`image-reader.component.html:32-43`

```html
<img [src]="page.path" ... decoding="async" appImageFallback />
```

Não existe `srcset`, `sizes`, nem `fetchpriority` — confirmado por grep em todo o diretório dos
leitores. Todas as coortes descarregam exatamente o mesmo ficheiro.

Custo [modelado] para um capítulo de 20 páginas com páginas de 1200 × 1800 px (~250 kB em JPEG):

| Perfil | Largura útil | Bytes descarregados | Tempo de transferência |
|---|---|---|---|
| Celular (Slow 4G, ~200 kB/s) | 412 px | 5,0 MB | **~25 s** |
| Tablet (Wi-Fi 10 Mbps) | 820 px | 5,0 MB | ~4 s |
| Comutador (cabo 10 Mbps) | 1200 px | 5,0 MB | ~4 s |

O celular consome ~2,9× mais pixels do que consegue mostrar (1200 px de imagem para 412 px de
contentor; mesmo a DPR 3 seriam 1236 px físicos, mas as páginas de mangá raramente precisam da
densidade total). Numa ligação limitada e frequentemente tarifada, isto é o maior custo isolado de
todo o módulo — maior do que todos os achados de CPU somados.

**Correção:** `srcset`/`sizes` com variantes servidas pela API, ou `NgOptimizedImage` com um loader
personalizado. Adicionalmente, `fetchpriority="high"` e **remover `decoding="async"`** na primeira
imagem: ela é o elemento LCP, e a descodificação assíncrona pode atrasar a apresentação.
**Critério de aceite:** o celular transfere ≤ 40 % dos bytes do desktop para o mesmo capítulo.

> **Dependência:** esta correção pressupõe que a API sabe servir variantes de tamanho. Não foi
> verificado. Se não souber, o trabalho é primeiro no backend.

---

### P-05 · `document-reader`: a virtualização desalinha após duas páginas — **Crítica**

`document-reader.component.ts:40, 226-256`

```ts
const ESTIMATED_PAGE_HEIGHT = 1200;
...
const startPage = Math.max(1, Math.floor(scrollOffset / this.estimatedPageHeight) - PAGE_BUFFER);
const endPage   = Math.min(this.totalPages(),
                  Math.ceil((scrollOffset + windowHeight) / this.estimatedPageHeight) + PAGE_BUFFER);
```

As páginas que já renderizaram deixam de ter 1200 px — passam a ter a altura real do canvas, que
depende da largura do contentor e do formato do documento. Mas o mapeamento
`scrollOffset → índice de página` continua a dividir por 1200.

**Aritmética do desvio:** com altura real `H`, após `k` páginas o erro acumulado é `k · (H − 1200)`
px. Um viewport inteiro de erro ocorre em `k = altura_viewport / (H − 1200)` páginas:

| Perfil | Altura real típica de página A4 renderizada | Erro de 1 viewport após |
|---|---|---|
| Celular (412 px de largura) | ~583 px (menor que a estimativa) | ~1,3 páginas |
| Tablet (820 px) | ~1.160 px | ~30 páginas |
| Comutador (1200 px) | ~1.697 px | **~2 páginas** |

O sintoma para o utilizador: a partir da segunda ou terceira página, o `visiblePages` calculado
aponta para páginas que não estão no ecrã. O leitor vê o placeholder `<span>Página N</span>`
(`document-reader.component.html:52-54`) em vez do conteúdo, enquanto páginas fora do ecrã são
renderizadas em vão. Em desktop — a coorte com maior probabilidade de ler PDFs longos — o
problema aparece quase imediatamente.

Nota: o perfil celular calha ficar melhor por acidente, porque a página real é *menor* que a
estimativa e o buffer de ±3 absorve o erro por mais tempo.

**Correção:** substituir a estimativa fixa por medição real. O `IntersectionObserver` já existe e já
observa cada contentor (`:295-330`) — deve ser ele a decidir o que está visível, com o buffer
aplicado sobre índices observados, em vez de aritmética de altura. Alternativa: `@angular/cdk/scrolling`
com `autosize`, já que `@angular/cdk` é dependência do projeto.
**Critério de aceite:** rolar um PDF de 100 páginas nos três perfis sem que nenhum placeholder
"Página N" fique visível por mais de 300 ms.

---

### P-06 · `pdf-page`: escala de rasterização ignora o DPR — **Alta**

`pdf-page/pdf-page.component.ts:112-135`

```ts
const containerWidth = canvas.parentElement?.clientWidth || window.innerWidth;
const scale = containerWidth / unscaledViewport.width;
const finalScale = Math.min(scale * 1.5, 3.0);   // 1,5 fixo, sem devicePixelRatio
```

O `1.5` é uma constante arbitrária que substitui `window.devicePixelRatio`. O resultado erra nos
dois sentidos, e em direções opostas conforme a coorte.

Aritmética exata para uma página Letter (612 pt de largura), com `PAGE_BUFFER = 3` → 7 páginas
residentes em memória, a 4 bytes por pixel:

| Perfil | Contentor | `finalScale` | Canvas | Memória/página | **7 páginas** | Resolução vs. píxeis físicos |
|---|---|---|---|---|---|---|
| Celular | 412 px | 1,01 | 618 × 800 | 2,0 MB | **14 MB** | 618 / 1236 = **0,50×** → texto suave/ilegível |
| Tablet | 820 px | 2,01 | 1230 × 1592 | 7,8 MB | **55 MB** | 1230 / 1640 = **0,75×** → visivelmente suave |
| Comutador | 1200 px | 2,94 | 1800 × 2330 | 16,8 MB | **117 MB** | 1800 / 1200 = 1,5× → desperdício |

Dois defeitos distintos, com a mesma raiz:

1. **Celular e tablet renderizam abaixo da resolução do ecrã.** Em ecrãs a DPR 3, o PDF sai a metade
   dos píxeis físicos disponíveis — texto de documento fica suave, e é o caso de uso onde a nitidez
   mais importa.
2. **Desktop e tablet em paisagem retêm ~117 MB de canvas** (mais o *probe* oculto, ver P-08). Num
   iPad em paisagem — que também atinge o teto de 1200 px — isto aproxima-se perigosamente do
   limite prático de ~256 MB por aba do WebKit, cujo comportamento ao ser excedido é descartar a
   página.

**Correção:**

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const finalScale = Math.min(scale * dpr, 3.0);
```

e reduzir `PAGE_BUFFER` para 1 em viewports estreitos, ou libertar os canvas fora de vista com
`canvas.width = 0` no `ngOnDestroy` (hoje `:88-92` só cancela a render task; o buffer do canvas
permanece).
**Critério de aceite:** heap snapshot com o leitor de PDF aberto mostra < 60 MB de canvas em
desktop; texto de PDF nítido a DPR 2 num tablet.

---

### P-07 · `image-reader`: colapso de layout ao descarregar imagens — **Alta**

`image-reader.component.ts:197-224` (descarregamento) + `:254-278` (dimensionamento)

```ts
// lazyLoadObserver, rootMargin '200% 0px'
} else {
  if (this.shouldLoadPages.has(index)) { this.shouldLoadPages.delete(index); hasChanges = true; }
}
```

```ts
getPageAspectRatio(page, index) {
  if (page.metadata?.width && page.metadata?.height) return `${w} / ${h}`;
  if (this.loadedPages.has(index)) return 'auto';        // ← linha 258
  ...
}
getPageMinHeight(page, index) {
  ...
  if (this.loadedPages.has(index)) return 'auto';        // ← linha 271
  ...
}
```

Sequência para uma página **sem `metadata`** (o campo é opcional em `Page`,
`src/app/core/models/book.models.ts:230-236`):

1. Página entra na janela de 200 % → `<img>` é inserido.
2. `load` dispara → `loadedPages.add(index)`.
3. `aspect-ratio` passa a `auto` e `min-height` passa a `auto` — o contentor deixa de reservar
   espaço e passa a ser dimensionado pela imagem.
4. O leitor rola 2 viewports → a página sai da janela → **o `<img>` é removido do DOM**.
5. `loadedPages` **não é limpo** (só é limpo quando o input `pages` muda, `:59-64`) → o contentor
   continua com `auto`/`auto`, agora sem conteúdo → **colapsa para altura ≈ 0**.

Consequências:

- **CLS:** um colapso de altura de viewport inteiro produz uma pontuação de shift próxima de 1,0.
  O limiar "Bom" é 0,1 — uma única ocorrência excede-o em 10×.
- **Salto de scroll:** o conteúdo abaixo sobe, e o leitor perde a posição — o pior sintoma possível
  numa app de leitura.
- Afeta as **três coortes** por igual; é geometria, não desempenho.

**Correção mínima:** guardar as dimensões observadas no `onImageLoad` e usá-las como
`aspect-ratio` permanente, em vez de devolver `'auto'`:

```ts
onImageLoad(index: number, img: HTMLImageElement) {
  this.measured.set(index, img.naturalWidth / img.naturalHeight);
  this.loadedPages.add(index);
  this.cdr.markForCheck();
}
```

**Critério de aceite:** rolar 20 páginas para baixo e voltar ao topo com CLS acumulado ≤ 0,1 e sem
alteração da posição de scroll.

**Questão em aberto:** vale a pena descarregar de todo? Com `rootMargin: '200%'` a janela já é
generosa; remover o `<img>` obriga a nova requisição ao voltar atrás — cujo custo depende dos
cabeçalhos de cache das imagens, **que não foram inspecionados**. Se as imagens forem cacheáveis, o
descarregamento é defensável; se não, está a duplicar o custo de P-04.

---

### P-08 · `document-reader`: *probe* oculto renderiza uma página extra — **Baixa**

`document-reader.component.html:26-32`

```html
<!-- Hidden probe to detect total pages AND KEEP DOCUMENT ALIVE (v2) -->
<div class="pdf-probe">
  <ng-container [ngComponentOutlet]="pdfPageComponent()" [ngComponentOutletInputs]="probeInputs" />
</div>
```

Um `<pdf-viewer>` completo é instanciado para a página 1 apenas para obter `numPages` e manter o
`PDFDocumentProxy` vivo. Isso rasteriza uma página inteira (+16,8 MB de canvas em desktop, somando
a P-06) que ninguém vê.

**Correção:** carregar o documento com `pdfjs.getDocument(src).promise` diretamente e guardar o
proxy num sinal — `numPages` fica disponível sem renderizar nada. O comentário "(v2)" sugere que
isto já foi uma solução de contorno para um bug de ciclo de vida; vale documentar qual, antes de
remover.

---

### P-09 · Fugas de memória e recursos — **Média**

| Local | Problema |
|---|---|
| `image-reader.component.ts:153-157` | `ngOnDestroy` desconecta `intersectionObserver` mas **não** `lazyLoadObserver` (criado em `:197`). O observer retém os elementos DOM observados após a destruição do componente. Navegar por 10 capítulos deixa 10 observers vivos. |
| `document-reader.component.ts:289-293` | `ngOnDestroy` não limpa `scrollTimeout` (`:110`). Um timeout pendente executa `updateVisiblePages` sobre um componente destruído, acedendo a `this.pageRefs`. |
| `document-reader.component.ts:77, 258-271` | `inputsCache` cresce uma entrada por página visitada e só é limpo quando `src` muda. Para um PDF de 500 páginas são 500 objetos retidos — pequeno, mas ilimitado. |
| `pdf-page.component.ts:88-92` | `ngOnDestroy` cancela a render task mas não liberta o buffer do canvas (`canvas.width = 0`). Ver P-06. |

Coorte mais afetada: **Celular**, que é onde a pressão de memória se traduz em descarte da aba.

**Correção:** todas triviais. Um único `DestroyRef` com registo de cleanup por recurso resolveria
as quatro de forma uniforme.

---

### P-10 · Chamadas de função em bindings de template — **Baixa**

`image-reader.component.html:9-10`

```html
[style.aspect-ratio]="getPageAspectRatio(page, $index)"
[style.min-height]="getPageMinHeight(page, $index)"
```

Duas invocações por página em cada ciclo de deteção de mudanças. Com 40 páginas e os 20 ciclos/s
forçados pelo host (P-01 do relatório irmão), são ≈ 1.600 invocações por segundo de scroll, cada uma
com consultas a `Set` e leituras de sinais.

Isoladamente é ruído; combinado com P-01 do host, faz parte do mesmo problema. A correção limpa é
calcular o estilo uma vez por página num `computed`, ou aplicar as dimensões no `onImageLoad`.
`document-reader.component.html:39` tem o mesmo padrão com `createPdfPageInputs(pageNum)` (mitigado
por cache, mas ainda uma chamada por ciclo).

---

## 5. Achados de usabilidade e acessibilidade

### U-01 · `document-reader`: sem qualquer controlo de navegação — **Alta**

O template não oferece nem indicador de página atual, nem campo "ir para a página", nem botões de
página anterior/seguinte. `showPageNumbers` está declarado como input (`:56`) mas o host **nunca o
passa** (`pages/chapters/chapters.component.html:84-92` só passa `src`, `format`, `initialPage`), pelo
que o bloco `@if (showPageNumbers())` (`html:55-57`) é código morto na prática.

A única navegação disponível é a barra de progresso de 4 px do host — que, conforme U-03 do
relatório irmão, é inutilizável em toque. Para um PDF de 300 páginas, o utilizador de **celular ou
tablet** não tem forma prática de chegar à página 200.

**Correção:** barra de ferramentas fixa com "página X de Y" e campo de salto; passar
`showPageNumbers` a partir das definições do leitor, que já expõem essa opção no formulário.

---

### U-02 · `text-reader`: `WORDS_PER_PAGE = 300` é invisível e inconsistente — **Média**

`text-reader.component.ts:36, 145-151`

A paginação virtual assume 300 palavras por página, independentemente do tamanho de letra, da
altura de linha e do viewport — todos configuráveis no `reader-settings-form`. Um utilizador de
**celular** com corpo 24 px vê talvez 80 palavras por ecrã; a "página" virtual do sistema tem 300.
Um utilizador de **desktop** com corpo 16 px vê talvez 500. O mesmo `pageIndex` guardado significa
posições muito diferentes conforme o dispositivo — o que rompe a sincronização de progresso entre
dispositivos.

E a contagem de palavras é feita sobre o markdown em bruto com três `replace` de regex
(`:145-151`): tabelas, blocos de código e URLs inflacionam a contagem.

**Correção:** persistir a **percentagem de scroll** como fonte de verdade em vez do índice de página
virtual. É independente do dispositivo, do corpo de letra e da contagem de palavras. Isto liga-se
diretamente a U-01/U-02 do relatório irmão — as três correções pertencem à mesma unidade de
trabalho.

---

### U-03 · `image-reader`: menu de contexto sem equivalente por teclado — **Média** (WCAG 2.1.1, A)

`image-reader.component.html:11` liga `(contextmenu)` no contentor da página. Não há handler de
teclado nem controlo visível — confirmado: zero ocorrências de `keydown`/`keyup` em todo o
diretório dos leitores.

A tecla `Menu`/`Shift+F10` dispara o evento `contextmenu` nativo em alguns browsers, mas o
contentor não é focável (`<div>` sem `tabindex`), portanto nunca recebe o evento. Para o perfil
**Comutador** com navegação por teclado, "Baixar Página" e "Salvar Página" são inalcançáveis.

**Correção:** `tabindex="0"` no contentor da página, com handler para `Shift+F10`/`ContextMenu`, ou
um botão de ações visível ao focar.

---

### U-04 · `image-reader`: `alt` não descritivo — **Baixa** (WCAG 1.1.1, A)

`alt="Página {{ $index + 1 }}"`. Não é errado — é a melhor aproximação disponível sem texto
alternativo real — mas para um leitor de ecrã o capítulo inteiro anuncia-se como "Página 1, Página
2, Página 3…". Se a API vier a expor OCR ou legendas, é aqui que entram. Registado como limitação
conhecida, não como defeito acionável hoje.

---

### U-05 · `reader-settings-form`: 508 linhas de template sem virtualização nem persistência de aba — **Média**

`reader-settings-form.component.html` (508 linhas) monta **todos** os grupos de definições no DOM e
alterna a visibilidade com `viewFilter`. O componente é aberto dentro de uma notificação modal
(`pages/chapters/chapters.component.ts:923`), portanto o custo é pago em cada abertura.

Além disso:

- `viewFilter` é uma propriedade de classe simples (`:65-71`), não um sinal — num componente
  `OnPush` numa app *zoneless*, depende inteiramente do evento de clique para agendar o CD. Funciona
  hoje por acidente do binding de eventos, mas é frágil e contraria o padrão de sinais adotado no
  resto do módulo.
- A aba escolhida não persiste entre aberturas: o utilizador que ajusta o brilho, fecha e reabre,
  volta sempre a "Geral".
- Em **celular**, a media query de 768 px (`scss:158-172`) põe os botões de aba a `calc(50% - 4px)`
  — duas por linha. Com cinco abas possíveis, ficam três linhas de botões antes de qualquer
  definição ficar visível, num viewport de 823 px de altura.

**Correção:** `@if` por grupo em vez de esconder por CSS, `viewFilter` como `signal`, e persistir a
última aba nas definições (o `SettingsService` já persiste em localStorage).

---

### U-06 · Sem `prefers-reduced-motion` em nenhum dos leitores — **Baixa**

`image-reader.component.scss:46` (`transition: opacity 0.6s`), `:80`, `:11`;
`text-reader.component.scss:15`; `document-reader.component.scss:113`.

O projeto tem o mixin em `public/assets/scss/_mixins.scss:27` e respeita a media query em cinco
outras páginas. Os leitores não. O fade-in de 0,6 s por imagem é precisamente o tipo de animação
repetitiva que a preferência existe para suprimir.

---

### U-07 · Código morto — **Baixa**

| Símbolo | Local |
|---|---|
| `textStyle()` + `styleSnapshot` | `text-reader.component.ts:68-91` — o template usa bindings `[style.*]` diretos; confirmado por grep que `textStyle` não aparece no HTML. O comentário admite que existe para "templates em cache" |
| `resetProgress()` | Nos três leitores — nenhum é chamado pelo host |
| `getPageRefs()` | `image-reader:246`, `document-reader:402` — não referenciados |
| `showPageNumbers` | `document-reader:56` — input nunca passado pelo host |
| `isPageVisible`/`probeInputs` públicos | Superfície de API maior do que o necessário |

`npm run check:dead-code` (Knip, já configurado no projeto) deve apanhar a maioria.

---

## 6. Backlog priorizado

| Pri | Item | Esforço | Coortes | Tipo |
|---|---|---|---|---|
| 1 | **P-05** — virtualização do PDF por `IntersectionObserver` em vez de altura fixa | M | Todas | Correção |
| 2 | **P-07** — reservar espaço com dimensões medidas; parar o colapso ao descarregar | S | Todas | Correção/CLS |
| 3 | **P-04** — `srcset`/`sizes` + `fetchpriority` na primeira imagem | M* | Celular | Perf |
| 4 | **P-06** — escala de canvas por DPR; libertar canvas fora de vista | S | Celular, Tablet | Perf |
| 5 | **P-03** — apagar o `IntersectionObserver` inerte do leitor de texto | XS | Celular | Perf |
| 6 | **P-02** — throttle de 100 ms e correção de unidades no `emitProgress` | XS | Celular | Perf |
| 7 | **P-09** — desconectar `lazyLoadObserver`, limpar `scrollTimeout` | XS | Celular | Correção |
| 8 | **U-01** — controlos de navegação no leitor de documentos | M | Celular, Tablet | UX |
| 9 | **U-02** — persistir percentagem em vez de página virtual | M | Todas | UX |
| 10 | **P-01** — cachear `scrollHeight` no leitor de imagens | XS | Celular | Perf |
| 11 | **U-03, U-05** — teclado no menu de contexto; formulário de definições | M | Comutador, Celular | A11y/UX |
| 12 | **P-08, P-10, U-06, U-07** — probe, bindings, motion, limpeza | S | — | Qualidade |

\* P-04 é M **se** a API já servir variantes de tamanho; caso contrário depende de trabalho no
backend e passa a L.

Os itens 5, 6, 7 e 10 são todos XS, somam menos de uma hora e eliminam trabalho por frame em todos
os capítulos.

---

## 7. Observação estrutural

Os três leitores implementam a mesma interface de facto — `scrollToPage(i)`, `resetProgress()`,
progresso emitido, `IntersectionObserver`, listener de scroll — sem que essa interface exista no
código. O host lida com isso através de três `@ViewChild` e de cadeias de `if/else if`
(`pages/chapters/chapters.component.ts:734-763`, `:812-825`), o que:

- anula o `@defer` dos três leitores (§3.2),
- obriga o host a conhecer o tipo de conteúdo em cinco sítios diferentes,
- e permitiu que as três implementações divergissem em `throttleTime` (20/20/100 ms), estratégia de
  virtualização e gestão de ciclo de vida — que é a origem direta de P-01, P-02, P-03, P-05 e P-09.

Extrair uma `ReaderContract` (interface + token de injeção) e um `ScrollProgressService` partilhado
resolveria estruturalmente cinco dos dez achados de performance. Não é pré-requisito para nenhuma
das correções acima — mas sem isso, a próxima divergência é uma questão de tempo.

---

## 8. Riscos e o que falta verificar

1. **Nenhum número de tempo ou memória foi medido.** Confirmar P-06 com um heap snapshot e P-05
   com scroll manual num PDF de 100+ páginas nos três perfis, antes de aceitar as correções.
2. **Cabeçalhos de cache das imagens não inspecionados** — determinam se o descarregamento em P-07
   é benéfico ou prejudicial.
3. **Suporte da API a variantes de imagem não verificado** — bloqueia P-04.
4. **O comentário "(v2)" no probe do PDF** (P-08) sinaliza um bug de ciclo de vida anterior que não
   foi possível reconstituir a partir do código. Investigar o histórico antes de remover o probe.
