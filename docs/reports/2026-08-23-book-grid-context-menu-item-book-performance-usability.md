# Análise Técnica — `book-grid`, `context-menu` e `item-book`

**Data:** 2026-08-23 · **Branch:** `developer` · **Commit base:** `912fc3d`
**Escopo:**
`src/app/shared/ui/organisms/book-grid` ·
`src/app/shared/ui/organisms/context-menu` ·
`src/app/features/books/components/item-book`

**Relatórios irmãos:**
[`chapters`](./2026-08-23-chapters-performance-usability.md) ·
[`readers`](./2026-08-23-readers-performance-usability.md)

---

## 1. Sumário executivo

Estes três componentes formam o caminho de descoberta da aplicação: a grelha que lista livros, o
card individual e o menu de contexto que ambos usam. São consumidos por `home`, `books`, `library`
e `info-book` — ou seja, é a primeira coisa que qualquer utilizador vê.

O padrão dominante é diferente do dos relatórios anteriores. Ali o problema era trabalho por frame;
aqui é **trabalho por card multiplicado pelo número de cards**, com dois achados que escalam
linearmente com o tamanho da lista:

| # | Problema | Coorte mais afetada | Severidade |
|---|---|---|---|
| P-01 | `isBookDownloaded()` materializa todos os capítulos (com Blobs) do IndexedDB para verificar `length > 0` — uma vez por card | Todas | Crítica |
| P-02 | Cada card subscreve o mesmo `downloadProgress$` global; um download re-renderiza a grelha inteira | Todas | Crítica |
| U-01 | Menu de contexto sem qualquer suporte a teclado (`role`, foco, Escape, setas) | Comutador | Crítica |
| U-02 | Em iOS/iPadOS o evento `contextmenu` não dispara — o menu inteiro é inalcançável | Tablet | Crítica |

Há também trabalho bem feito que vale registar: `content-visibility: auto` com
`contain-intrinsic-size` calibrado por tipo de card, o placeholder do `@defer` com altura alinhada
ao card real, e o comentário no `context-menu` a explicar por que razão os listeners de documento
estão fora do binding do Angular. São decisões conscientes e corretas, com o raciocínio registado
no código.

**Veredicto:** a camada de apresentação está sólida; a camada de dados por card não está. Os dois
achados críticos de performance têm a mesma raiz — cada card fala diretamente com o
`DownloadService` — e resolvem-se com a mesma mudança estrutural.

---

## 2. Metodologia, perfis de cliente e métricas de referência

Idênticos aos dois relatórios anteriores, repetidos aqui para o documento ser autónomo.

### 2.1 O que foi feito

- Análise estática dos três componentes, dos respetivos templates e estilos, e das dependências que
  determinam o seu custo: `ContextMenuService`, `BodyScrollService`, `DownloadService`,
  `_dropdown-menu.scss`, `_mixins.scss`.
- **Build de produção real** (`npx ng build --configuration production`, exit 0) — os tamanhos de
  chunk na secção 3 são medidos, incluindo verificação de duplicação de código entre chunks.
- Aritmética de grelha exata sobre as media queries, para determinar o número de colunas por perfil.

### 2.2 Limites — leia antes de agir sobre os números

> **Não houve profiling em runtime.** Sem Lighthouse, sem trace, sem heap snapshot, sem medição de
> IndexedDB. Os valores de tempo, memória e contagem de re-renders estão marcados `[modelado]` e
> derivam de aritmética direta sobre o código aplicada aos perfis abaixo. São ordens de grandeza
> defensáveis, não medições. **P-01 em particular precisa de medição** — o custo real depende de
> como o motor de IndexedDB do browser materializa Blobs, que varia entre Chromium e WebKit.

### 2.3 As três bases de clientes

| Perfil | Viewport CSS | DPR | CPU | Rede |
|---|---|---|---|---|
| **Celular** (Android médio, classe Moto G Power) | 412 × 823 | 1,75–3 | 4× throttling | Slow 4G: 1.638 Kbps, 150 ms RTT |
| **Tablet** (iPad 10.9", Safari iOS) | 820 × 1180 | 2 | ~2× | Wi-Fi 10 Mbps, 40 ms RTT |
| **Comutador** (desktop 1080p, Chromium) | 1920 × 1080 | 1 | — | Cabo 10 Mbps, 40 ms RTT |

### 2.4 Métricas de referência

| Métrica | Limiar | Fonte |
|---|---|---|
| LCP (p75) | ≤ 2,5 s | Core Web Vitals |
| INP (p75) | ≤ 200 ms | Core Web Vitals |
| CLS (p75) | ≤ 0,1 | Core Web Vitals |
| Long task | > 50 ms | RAIL |
| Alvo de toque | ≥ 24 × 24 px CSS | WCAG 2.2 SC 2.5.8 (AA) |
| Teclado | toda a funcionalidade operável | WCAG 2.2 SC 2.1.1 (A) |
| Nome/Função/Valor | controlos com role e estado expostos | WCAG 2.2 SC 4.1.2 (A) |
| Conteúdo em hover | persistente, dispensável, apontável | WCAG 2.2 SC 1.4.13 (AA) |

WCAG AA e aprovação AXE são requisitos declarados em
`docs/guidelines/angular-architecture-best-practices.md`.

### 2.5 Geometria da grelha por perfil (calculada a partir do SCSS)

De `book-grid.component.scss:1-47`, com `max-width: 1500px` no contentor:

| Perfil | Largura útil | `minmax` | Colunas | Largura de coluna | Cards visíveis (aprox.) |
|---|---|---|---|---|---|
| Celular | 382 px (padding 15) | 140 px | **2** | 180 px (teto) | ~4 acima da dobra |
| Tablet | 780 px (padding 20) | 200 px | **3** | ~246 px | ~6 |
| Comutador | 1460 px (teto 1500) | 200 px | **6** | ~226 px | ~12 |

A geometria é sã nos três perfis. Uma inconsistência: `.list` muda para uma coluna aos 900 px
(`:32-36`) mas `.grid`/`.cover` mudam de `minmax` aos 768 px (`:38-48`). Entre 769 e 900 px — a
faixa do tablet em retrato — a vista de lista já é de coluna única enquanto a grelha ainda usa a
densidade de desktop. Dois breakpoints para o mesmo contentor sem razão aparente.

---

## 3. Evidências medidas (build de produção)

| Chunk | Raw | Gzip | Conteúdo |
|---|---|---|---|
| `chunk-TMMTWAIR.js` | 20.473 B | **5.805 B** | `ItemBookComponent` |
| `chunk-QT64MCJM.js` | 5.253 B | 1.536 B | `BookGridComponent` |
| `chunk-XFOM7FYS.js` (`info-book-component`) | 89.443 B | 19.613 B | contém **uma segunda cópia** do `ItemBookComponent` |

### 3.1 `ItemBookComponent` está duplicado em dois chunks — medido

A string única `"Corrigir Capas"` (só existe em `item-book.component.ts:224`) aparece em dois
chunks distintos: `chunk-TMMTWAIR.js` e `chunk-XFOM7FYS.js`. O componente é importado tanto pelo
`BookGridComponent` como pelo `InfoBookComponent`, e o code-splitting não o partilhou.

**Custo:** 5.805 B gzip descarregados duas vezes por quem visita uma página de grelha e depois a
página de detalhe de um livro — o percurso mais comum da aplicação. Em Slow 4G a ~200 kB/s são
~29 ms mais um round-trip de 150 ms, portanto na prática **~0,18 s** de atraso evitável.

**Correção:** investigar a fronteira de `@defer` que separa os dois caminhos de import; o mais
provável é que `info-book` importe o componente eagerly enquanto `book-grid` o difere, impedindo o
esbuild de fatorizar. **Critério de aceite:** `grep -c "Corrigir Capas" dist/front/browser/*.js`
devolve exatamente um chunk.

### 3.2 Não existe `IMAGE_LOADER` configurado — verificado

`grep -rn "IMAGE_LOADER\|provideImgix\|ImageLoader" src/app/` não devolve nada, e `app.config.ts`
não regista nenhum loader. Ver P-04.

---

## 4. Achados de performance

### P-01 · `isBookDownloaded()` lê todos os capítulos com Blobs para contar — **Crítica**

`item-book.component.ts:127-134` (efeito por card) e `:232-244` (de novo, ao abrir o menu)

```ts
effect(() => {
  const bookId = this.book()?.id;
  if (bookId) {
    this.downloadService.isBookDownloaded(bookId)
      .then((downloaded) => this.isDownloaded.set(downloaded));
  }
});
```

O que essa chamada faz, seguindo a cadeia até ao serviço:

```ts
// download.service.ts:174-178
async isBookDownloaded(bookId: string): Promise<boolean> {
  const chapters = await this.getChaptersByBook(bookId);
  return chapters.length > 0;
}

// download.service.ts:129-133
async getChaptersByBook(bookId: string): Promise<OfflineChapter[]> {
  return db.getAllFromIndex('chapters', 'by-book', bookId);
}
```

E `OfflineChapter` (`core/models/offline.models.ts:26-41`) contém:

```ts
pages: Blob[];       // IMAGE: array de blobs de imagem
document?: Blob;     // DOCUMENT: blob único de PDF/EPUB
```

`getAllFromIndex` faz **structured clone de todos os registos de capítulo do livro, com todos os
Blobs**, para depois o chamador ler apenas `.length`. Não é uma contagem — é uma materialização
completa.

**Escala do problema.** O efeito corre uma vez por card montado. Nas páginas que usam a grelha:

| Página | Cards | Chamadas a `getAllFromIndex` no carregamento |
|---|---|---|
| `library` (`library.component.ts:79,97`) | até 50 + 50 | **até 100** |
| `books` (`books.component.ts:541`) | 20 por página | 20 por página, acumulando no scroll |
| `home` | conforme secções | uma por card |

Para um livro descarregado de 100 capítulos com 20 páginas cada, é a desserialização de 2.000
entradas de Blob para responder a uma pergunta booleana. Para livros **não** descarregados o
resultado é um array vazio e o custo é apenas o do índice — que é o caso maioritário e a razão pela
qual isto provavelmente ainda não explodiu em produção.

**Custo [modelado]:** numa biblioteca com 10 livros descarregados entre 50 cards, o carregamento da
página dispara 50 leituras de índice das quais 10 materializam blobs. No perfil **Celular**, onde o
IndexedDB é mais lento e a memória mais escassa, é o candidato mais forte a long task no
carregamento da biblioteca.

**Correção:** o `idb` já expõe a operação certa.

```ts
async isBookDownloaded(bookId: string): Promise<boolean> {
  if (!this.dbPromise) return false;
  const db = await this.dbPromise;
  return (await db.countFromIndex('chapters', 'by-book', bookId)) > 0;
}
```

Melhor ainda: o store `books` já guarda `totalChapters` no `saveBook` (`download.service.ts:78-90`) —
um único `db.get('books', bookId)` responde sem tocar no store de capítulos.

**Critério de aceite:** teste que grava um livro com 50 capítulos e afirma que `isBookDownloaded`
não invoca `getAll`/`getAllFromIndex` sobre o store `chapters`.

> **Precisa de medição.** Chromium mantém Blobs de IndexedDB apoiados em disco e pode não os
> materializar na íntegra; o WebKit é mais eager. O custo real varia por motor — mas a correção é
> barata e correta independentemente do resultado da medição.

---

### P-02 · Um download re-renderiza a grelha inteira — **Crítica**

`item-book.component.ts:136-147` (por card) + `download.service.ts:58-76`

Cada card abre uma subscrição própria ao **mesmo observable global**:

```ts
// item-book — uma subscrição por card
this.downloadService.getBookDownloadProgress(bookId)
  .subscribe((progresses) => this.downloadProgress.set(progresses));
```

```ts
// download.service.ts:68-76 — sem shareReplay, sem distinctUntilChanged
getBookDownloadProgress(bookId: string): Observable<DownloadProgress[]> {
  return this.downloadProgress$.pipe(
    map((progressMap) => Array.from(progressMap.values())
      .filter((p) => p.bookId === bookId)),
  );
}
```

```ts
// download.service.ts:58-62 — emite um Map novo a cada tick de progresso
private updateProgress(chapterId: string, progress: DownloadProgress) {
  const currentMap = this.progressSubject.value;
  currentMap.set(chapterId, progress);
  this.progressSubject.next(new Map(currentMap));   // nova identidade
}
```

A cadeia completa, por cada tick de progresso de **qualquer** download:

1. `updateProgress` aloca um `Map` novo e emite.
2. Os **N** cards subscritos recebem a emissão.
3. Cada um corre `Array.from(map.values())` + `.filter()` — **N × M** operações, com M = entradas de
   progresso ativas.
4. Cada um chama `downloadProgress.set(novoArray)`. O array é **sempre uma instância nova**, mesmo
   quando vazio, portanto o sinal muda **sempre** de identidade.
5. Isso invalida os três `computed` de cada card — `isDownloading`, `downloadPercent`, `dashOffset`
   (`:78-121`).
6. **Os N cards re-renderizam.**

O passo 4 é o que transforma um problema local num problema global: 39 dos 40 cards recebem um
array vazio que é semanticamente idêntico ao anterior, mas que o sistema de sinais não pode saber
que é igual.

**Custo [modelado]:** numa grelha de 40 cards, com progresso a emitir ~10×/s durante um download,
são 400 varrimentos de Map, 400 alocações de array e **400 re-renders de componente por segundo** —
enquanto 39 desses cards não têm nada a ver com o download em curso. No perfil **Celular** a 4× de
throttling isto é suficiente para tornar o scroll da grelha visivelmente irregular durante qualquer
download em segundo plano.

**Correção**, em três partes independentes e todas pequenas:

```ts
// 1. serviço: partilhar a fonte e não emitir o que não mudou
getBookDownloadProgress(bookId: string): Observable<DownloadProgress[]> {
  return this.downloadProgress$.pipe(
    map((m) => Array.from(m.values()).filter((p) => p.bookId === bookId)),
    distinctUntilChanged((a, b) => a.length === b.length
      && a.every((p, i) => p.current === b[i].current && p.status === b[i].status)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
```

2. Melhor ainda: expor um `Map` de progresso como sinal no serviço e deixar cada card derivar o seu
   com um `computed` — elimina as N subscrições por completo.
3. No card, só criar a subscrição quando ela pode importar (o livro está a descarregar ou está
   descarregado), em vez de sempre.

**Critério de aceite:** com uma grelha de 40 cards e um download ativo, um trace de 5 s mostra
re-render apenas do card em download.

---

### P-03 · `@defer (on viewport)` nos cards prioritários anula o LCP — **Alta**

`book-grid.component.html:14-19`

```html
@for (book of books(); track book.id; let i = $index) {
  @defer (on viewport) {
    <app-item-book [book]="book" [type]="type()" [priority]="i < 2" />
  } @placeholder { ... }
}
```

O `[priority]="i < 2"` está correto na intenção: marca os dois primeiros cards para
`fetchpriority="high"` e `<link rel="preload">` via `NgOptimizedImage`. Mas o `@defer (on viewport)`
aplica-se a **todos** os cards, incluindo esses dois — e o `priority` só produz efeito quando o
componente existe.

A sequência para o card que vai ser o elemento LCP:

1. Render inicial → só o `@placeholder`.
2. Layout → registo do `IntersectionObserver` do `@defer`.
3. Callback de intersecção → no frame seguinte.
4. `import()` do chunk `chunk-TMMTWAIR.js` (5.805 B gz) → **1 round-trip de rede**; este chunk não é
   coberto pelo `PreloadAllModules`, que só trata chunks de rota.
5. Componente renderiza → só agora a `<img>` existe e o pedido da capa começa.

O `preload` gerado pelo `priority` chega depois do passo 5 — ou seja, depois do momento em que
serviria para alguma coisa. **A otimização está a pagar-se e a não render nada.**

**Custo [modelado]:** 1 RTT (150 ms em Slow 4G) + ~2 frames + a perda total da vantagem de preload.
Estimativa de **+0,3 a +0,5 s de LCP** nas páginas `home` e `books` no perfil Celular — precisamente
onde o limiar de 2,5 s já é apertado.

**Correção:** não diferir o que está acima da dobra.

```html
@for (book of books(); track book.id; let i = $index) {
  @if (i < 4) {
    <app-item-book [book]="book" [type]="type()" [priority]="i < 2" />
  } @else {
    @defer (on viewport) { <app-item-book ... /> } @placeholder { ... }
  }
}
```

Considerar também `@defer (hydrate on viewport)` (Angular 19+, disponível na v21 que o projeto usa)
para os restantes: com o `@defer (on viewport)` atual, o SSR entrega o placeholder e o cliente
repete todo o trabalho, em vez de hidratar incrementalmente o que o servidor já renderizou.

**Critério de aceite:** o elemento LCP da `home` é a primeira capa, e o `<link rel="preload">` dela
aparece no HTML inicial.

---

### P-04 · `NgOptimizedImage` sem loader e sem `sizes` — nenhum `srcset` é gerado — **Alta**

`item-book.component.html:92-99`

```html
<img [ngSrc]="book().cover" alt="..." fill [priority]="priority()" ... />
```

Verificado na secção 3.2: **não há `IMAGE_LOADER` registado** em lado nenhum da aplicação. Sem
loader, o `NgOptimizedImage` cai no `noopImageLoader` e **não gera `srcset`**. E com `fill` sem
`sizes`, nem sequer há informação para o browser escolher uma variante, se ela existisse.

Sobra do `NgOptimizedImage`: `loading`, `fetchpriority`, o `preload` do `priority` e os avisos de
dev-mode. O benefício principal — servir a imagem certa a cada ecrã — está ausente.

**Custo [modelado].** Uma capa típica de 600 × 900 px em JPEG (~80 kB), numa grelha:

| Perfil | Largura de coluna | Bytes por página de grelha | Desperdício |
|---|---|---|---|
| Celular | 180 px | 20 cards × 80 kB = **1,6 MB** | ~3,3× os pixels necessários (180 px a DPR 2 = 360 px) |
| Tablet | 246 px | 3 col × ~4 filas visíveis | ~1,2× |
| Comutador | 226 px | 6 col × ~2 filas visíveis | ~1,3× |

Em Slow 4G a ~200 kB/s, 1,6 MB são **~8 s** para pintar uma página de grelha no celular. É o maior
custo isolado de todo o módulo — maior do que P-01 e P-02 somados.

Este é o mesmo achado do relatório dos leitores (P-04) noutro sítio, o que sugere que a origem é
uma lacuna de plataforma e não um descuido local: **não existe estratégia de imagem responsiva na
aplicação**.

**Correção:** registar um `IMAGE_LOADER` que aponte para as variantes da API e passar `sizes`:

```ts
// app.config.ts
{ provide: IMAGE_LOADER, useValue: (config: ImageLoaderConfig) =>
    `${config.src}?w=${config.width}` }
```

```html
<img [ngSrc]="book().cover" fill sizes="(max-width: 768px) 180px, 250px" ... />
```

**Critério de aceite:** o celular transfere ≤ 40 % dos bytes de capa do desktop para a mesma
grelha.

> **Dependência:** pressupõe que a API sabe servir variantes de tamanho. **Não foi verificado** —
> é a mesma dependência já registada no relatório dos leitores.

---

### P-05 · Sem virtualização: o custo por card multiplica-se sem teto — **Média**

`book-grid.component.html:13` faz `@for` sobre `books()` inteiro. Cada `ItemBookComponent` injeta
**sete serviços** (`item-book.component.ts:56-66`) e cria **dois efeitos** com trabalho assíncrono.

Numa página `books` com scroll infinito, ao fim de cinco páginas são 100 cards, 100 efeitos de
IndexedDB (P-01) e 100 subscrições ao progresso global (P-02). O `@defer (on viewport)` evita a
renderização mas **não** evita nada disto: uma vez montado, o card nunca é destruído ao sair da
vista.

O `content-visibility: auto` com `contain-intrinsic-size` por tipo
(`item-book.component.scss:198-203, 248-252`) já resolve bem o custo de *layout* offscreen — e o
comentário no código mostra que a calibração foi deliberada. O que falta é o equivalente para o
custo de *dados*.

**Correção:** dado que `@angular/cdk` já é dependência do projeto, `cdk-virtual-scroll-viewport` com
`itemSize` derivado do `contain-intrinsic-size` já calculado resolveria os dois de uma vez. Se a
virtualização for demasiado invasiva, a alternativa barata é corrigir P-01 e P-02, que reduzem o
custo por card a quase nada e tornam a virtualização opcional.

---

### P-06 · Download de livro inteiro dentro de um componente de item de lista — **Média**

`item-book.component.ts:266-374`

```ts
for (const chapterInfo of chapters) {
  ...
  await this.downloadService.downloadChapter(fullBook, fullChapter);
  await delay(500); // Small delay to be nice
}
```

Três problemas:

1. **`delay(500)` por capítulo.** Um livro de 200 capítulos acumula **100 s de espera artificial**,
   além do tempo real de download. Não há justificação registada para o valor.
2. **O ciclo sobrevive ao componente.** É uma função `async` comum, não ligada ao ciclo de vida. Sair
   da página destrói a grelha, mas o ciclo continua a correr, a escrever em sinais de uma view
   destruída (`cdr.markForCheck()` em `:275, 285, 313`) e a reter `fullBook` e cada `fullChapter`.
3. **Não há cancelamento.** Iniciado o download, o utilizador não tem forma de o parar.

O próprio código admite a duplicação: `// Background download logic similar to BookComponent`
(`:311`).

**Correção:** mover a orquestração para o `DownloadService` (que já detém a fila de progresso),
expor `cancel(bookId)`, e deixar o card apenas disparar e observar. Resolve a duplicação, o
cancelamento e a retenção de uma vez.

---

### P-07 · Chamadas de função em bindings e `ngStyle` — **Baixa**

| Local | Padrão |
|---|---|
| `item-book.component.html:82` | `@if (isBlobUrl(book().cover))` — chamada de função por ciclo de CD |
| `item-book.component.html:4` | `[ngStyle]="cardCoverStyle()"` — `NgStyle` faz diffing de objeto; `[style.--card-cover]` seria uma escrita direta |
| `item-book.component.html:7, 11, 76, 78` | `book().blurHash || book().coverMetadata?.blurHash` repetido em quatro sítios — merece um `computed` |

Isoladamente é ruído. Combinado com P-02, que força re-render de todos os cards, passa a
multiplicar-se por N.

---

### P-08 · `skeletonCount` não acompanha o tamanho de página — **Baixa**

`book-grid.component.ts:23` tem `skeletonCount = input<number>(10)`, mas `books.component.ts:541`
pagina a 20. Se o consumidor não passar o valor, a grelha mostra 10 esqueletos e depois insere 20
cards — a diferença de 10 cards de altura desloca tudo o que estiver abaixo.

Impacto em **CLS**, sobretudo no perfil Celular, onde 10 cards em 2 colunas são 5 filas de ~280 px
= ~1.400 px de deslocamento.

**Correção:** exigir `skeletonCount` alinhado ao limite de paginação, ou derivá-lo do próprio
serviço de listagem.

---

## 5. Achados de usabilidade e acessibilidade

### U-01 · Menu de contexto inoperável por teclado — **Crítica** (WCAG 2.1.1 nível A, 4.1.2 nível A)

`context-menu.component.html` e `context-menu.component.ts` — verificado: zero handlers de teclado
em todo o componente.

```html
<div class="menu-item" [class.disabled]="item.disabled" (click)="onItemClick($event, item)">
```

| Ausente | Consequência |
|---|---|
| `role="menu"` / `role="menuitem"` | O menu não é anunciado como menu; os itens são texto |
| `tabindex` | Nenhum item é focável — nem por Tab, nem programaticamente |
| Foco inicial ao abrir | O foco permanece onde estava; o leitor de ecrã não sabe que algo abriu |
| `Escape` para fechar | Só fecha com clique fora |
| Setas ↑/↓ para navegar | — |
| Devolução do foco ao fechar | — |
| `aria-disabled` | `.disabled` é apenas visual; o item continua a parecer ativo para AT |

O que está por trás deste menu não é decorativo: **"Baixar Livro", "Compartilhar", "Abrir em nova
aba", "Excluir Download" e "Corrigir Capas" existem exclusivamente aqui.** Um utilizador de teclado
não tem qualquer outro caminho para essas funções.

**Correção:** padrão de menu da APG do WAI-ARIA — `role="menu"` no contentor, `role="menuitem"` +
`tabindex="-1"` nos itens, foco no primeiro item ao abrir, `Escape`/setas/`Home`/`End`, e devolução
do foco ao elemento que abriu o menu.
**Critério de aceite:** AXE sem violações com o menu aberto; abrir, navegar, ativar e fechar o menu
usando apenas o teclado.

---

### U-02 · Em iOS/iPadOS o menu inteiro é inalcançável — **Crítica**

`item-book.component.html:5` liga `(contextmenu)="onContextMenu($event)"`, e é o **único** gatilho —
não existe botão "⋯", nem gesto alternativo, nem entrada equivalente noutro sítio da interface.

O Safari em iOS e iPadOS não despacha `contextmenu` de forma fiável para um long-press: intercepta o
gesto e apresenta o *callout* nativo do sistema (copiar link, abrir, partilhar). O resultado é que,
no perfil **Tablet** — e em qualquer iPhone — o long-press sobre um card mostra o menu do sistema
operativo e nunca o menu da aplicação.

**Funcionalidade perdida nessa coorte:** descarregar um livro para leitura offline, partilhar,
excluir download, corrigir capas. Numa aplicação de leitura, o download offline não é um extra.

Nota adicional: mesmo no Android, onde o `contextmenu` dispara com long-press, não existe qualquer
indicação visual de que o gesto está disponível. A funcionalidade é invisível em todas as coortes
de toque.

**Correção:** um botão de ações explícito no card (padrão "⋯" no canto), sempre visível em
`(hover: none)`, que abre exatamente o mesmo menu. Serve simultaneamente U-01, U-02 e U-04.
**Critério de aceite:** abrir o menu de um card e disparar "Baixar Livro" num iPad real.

---

### U-03 · O menu de contexto destrói o bloqueio de scroll de outros componentes — **Alta**

`context-menu.component.ts:36-46` + `core/services/body-scroll.service.ts`

```ts
effect(() => {
  if (this.state().visible) { ... this.bodyScrollService.disableScroll(); }
  else { this.bodyScrollService.enableScroll(); }
});
```

```ts
// body-scroll.service.ts — sem contagem de referências
disableScroll() { this.renderer.setStyle(document.body, 'overflow', 'hidden'); }
enableScroll()  { this.renderer.removeStyle(document.body, 'overflow'); }
```

`enableScroll()` remove o estilo incondicionalmente. Cenário reprodutível:

1. Um modal abre e chama `disableScroll()`.
2. O utilizador faz clique direito sobre algo → o menu abre → `disableScroll()` (redundante).
3. Escolhe um item → o menu fecha → o efeito corre → **`enableScroll()`**.
4. O modal continua aberto, mas **o fundo já rola.**

Além disso, o efeito corre uma vez no arranque com `visible: false`, chamando `enableScroll()` no
bootstrap da aplicação — potencialmente limpando um bloqueio posto por outro componente.

Há ainda uma questão de proporcionalidade: **um menu de contexto não deve bloquear o scroll da
página.** É o comportamento de um modal, não de um menu. No perfil Celular, `overflow: hidden` no
`body` provoca perda da posição de scroll no Safari ao ser removido.

**Correção:** contagem de referências no `BodyScrollService` (`private locks = 0`), e reavaliar se o
menu de contexto precisa de bloquear scroll de todo — fechar ao rolar seria mais convencional.
**Critério de aceite:** teste que abre um modal, abre e fecha o menu de contexto, e afirma que
`document.body.style.overflow` continua `hidden`.

---

### U-04 · Botão "remover" invisível mas clicável em toque — **Alta** (WCAG 2.2 SC 1.4.13)

`item-book.component.scss:67-84` + `:209-211`

```scss
.remove-btn {
  position: absolute; top: 10px; right: 10px;
  width: 32px; height: 32px;
  opacity: 0;                 // ← invisível por omissão
}
.book-card:hover .remove-btn { opacity: 1; }
```

`opacity: 0` esconde o botão mas **não remove a área clicável**. Nas coortes **Celular** e
**Tablet**, onde `:hover` nunca ocorre:

- O utilizador não tem forma de saber que a ação "remover do histórico" existe.
- Existe um alvo invisível de 32 × 32 px no canto superior direito de cada capa. Um toque para abrir
  o livro que caia nessa zona remove-o do histórico em vez de o abrir.

O `onRemove` chama `preventDefault()` e `stopPropagation()` (`:143-147`), portanto a navegação é
suprimida e a remoção acontece — sem confirmação.

**Correção:** `opacity: 1` sob `@media (hover: none)`, ou controlar a visibilidade por estado em vez
de por `:hover`. Se ficar escondido, tem de ficar também `pointer-events: none` e
`visibility: hidden`.

---

### U-05 · `<button>` dentro de `<a>` — HTML inválido — **Alta** (WCAG 4.1.2)

`item-book.component.html:1-5` abre `<a [routerLink]>` e `:16-24` coloca lá dentro um
`<button class="remove-btn">`.

O modelo de conteúdo de `<a>` proíbe descendentes interativos. O comportamento resultante é
indefinido entre browsers e tecnologias assistivas: alguns leitores de ecrã anunciam apenas a
âncora e nunca expõem o botão; a ordem de tabulação é imprevisível; a ativação por teclado pode
disparar os dois.

O mesmo problema aplica-se, em menor grau, ao `<svg role="img">` do anel de progresso (`:30-46`) e
aos badges, que são descendentes não interativos e portanto legítimos — o botão é o único caso
inválido.

**Correção:** tirar o botão de dentro da âncora, posicionando-o como irmão dentro de um contentor
`position: relative` comum.

---

### U-06 · Truncagem dupla, e `line-clamp` que não funciona no Safari — **Média**

Dois mecanismos de truncagem sobrepostos, nenhum a saber do outro.

**Em TypeScript** (`item-book.component.ts:165-180`):

```ts
if (title.length > 80)  return `${title.substring(0, 80)}...`;
if (desc.length > 150)  return `${desc.substring(0, 150)}...`;
```

**Em CSS** (`item-book.component.scss:265-276, 378-401`):

```scss
display: -webkit-box;
overflow: hidden;
text-overflow: ellipsis;
line-clamp: 2;
-webkit-box-orient: vertical;
```

Consequências:

1. **Reticências duplas.** Um título de 100 caracteres é cortado aos 80 com `...` acrescentado, e
   depois o CSS corta às 2 linhas e acrescenta o seu próprio `…`.
2. **A truncagem em JS não é responsiva.** 80 caracteres é o mesmo limite numa coluna de 180 px
   (Celular) e numa de 250 px (Comutador). O CSS já resolve isto por linhas — que é a medida certa.
3. **`line-clamp` sem `-webkit-line-clamp`.** A propriedade não prefixada só chegou ao Safari na
   versão 18.2. No perfil **Tablet** com iPadOS anterior, a regra é ignorada; sobra `height: 2.4rem`
   com `overflow: hidden`, ou seja **corte seco a meio da linha, sem reticências**.
4. **Leitores de ecrã** recebem o texto já cortado com `...`, e não existe `title` nem
   `aria-label` com o título completo — o utilizador de AT não tem acesso ao nome real do livro.

**Correção:** remover `truncatedTitle`/`truncatedDescription`, manter apenas o CSS, acrescentar
`-webkit-line-clamp` a par de `line-clamp`, e pôr o texto completo num `title` no elemento.

---

### U-07 · O menu de contexto abre depois de uma ida ao IndexedDB, e falha em silêncio — **Média**

`item-book.component.ts:232-244`

```ts
this.downloadService.isBookDownloaded(this.book().id)
  .then((isDownloaded) => {
    if (isDownloaded) { items.push(...); }
    this.contextMenuService.open(event, items);   // abertura DENTRO do .then
  });
// sem .catch
```

Dois defeitos:

1. **Latência percebida.** O menu só abre depois da consulta ao IndexedDB — que, por P-01, é a
   consulta cara. O utilizador clica com o botão direito e não acontece nada durante esse intervalo.
   O limiar RAIL para resposta a input é 100 ms.
2. **Falha silenciosa.** Não há `.catch`. Se o IndexedDB rejeitar — navegação privada, quota
   excedida, base bloqueada por outra aba — a promessa rejeita e **o menu nunca abre**. Sem erro,
   sem log, sem fallback. Para o utilizador, o clique direito simplesmente deixou de funcionar.

**Correção:** abrir o menu imediatamente com os itens conhecidos e acrescentar "Excluir Download"
de forma assíncrona (o `state` é um sinal — atualizar os itens é trivial); e envolver a promessa
num `.catch` que abre o menu na mesma.

---

### U-08 · Sem feedback ao paginar — **Média**

`book-grid.component.html:2` só mostra esqueletos quando `isLoading() && books().length === 0`. Ao
carregar a página 2 em diante, `books()` já não está vazio, portanto **não há indicação nenhuma** de
que algo está a carregar.

No perfil **Celular** em Slow 4G, onde a página seguinte pode demorar vários segundos, o utilizador
chega ao fim da lista e vê apenas o fim da lista.

**Correção:** um segundo bloco de esqueletos anexado ao fim quando `isLoading() && books().length > 0`.

---

### U-09 · Anel de progresso sem semântica, com rótulo em inglês — **Baixa**

`item-book.component.html:30-46`

```html
<svg height="28" width="28" class="progress-ring" role="img" aria-label="Loading">
```

- `aria-label="Loading"` numa aplicação inteiramente em português.
- `role="img"` para algo que é um indicador de progresso: o correto é `role="progressbar"` com
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, para que a percentagem seja anunciada.
- O `title="Baixando..."` no contentor não substitui isso — `title` é anunciado de forma
  inconsistente.

O valor já existe no componente (`downloadPercent()`, `:86`); só falta expô-lo.

---

### U-10 · Grelha sem semântica de lista, e texto não selecionável — **Baixa**

- `book-grid.component.html:1` é um `<div class="books-container">` sem `role="list"`, e os cards
  não são `role="listitem"`. Um leitor de ecrã não anuncia "lista de 20 itens" nem permite navegação
  por item.
- `book-grid.component.scss:6` aplica `user-select: none` ao contentor inteiro. Isto impede copiar
  o título de um livro — uma ação legítima e comum. A intenção era provavelmente evitar seleção
  acidental ao arrastar; o alvo certo seriam apenas as imagens (`-webkit-user-drag`), não o texto.

---

### U-11 · `shareBook`: fallback de clipboard sem tratamento de erro — **Baixa**

`item-book.component.ts:395-413`

```ts
navigator.clipboard.writeText(url).then(() => { ...success... });
// sem .catch
```

`navigator.clipboard` é indefinido em contextos não seguros e a escrita pode ser recusada por
permissão. Nesse caso a promessa rejeita e o utilizador não recebe nem o link nem uma mensagem. O
ramo `navigator.share` tem `.catch(console.error)` — que também não informa o utilizador, apenas o
console.

---

## 6. O que está bem feito

Registado explicitamente porque são decisões que devem sobreviver a qualquer refactor:

| Local | Decisão |
|---|---|
| `item-book.component.scss:198-203` | `content-visibility: auto` com `contain-intrinsic-size` **calibrado por tipo de card** (380 px grid / 280 px grid-mobile / 180 px list), com o raciocínio comentado. É a forma correta de o usar — um valor único causaria saltos de scroll. |
| `book-grid.component.scss:99-107` | O placeholder do `@defer` tem a altura alinhada ao card real, com comentário a explicar que a divergência custaria 30 px de deslocamento por card. Prevenção de CLS deliberada. |
| `context-menu.component.ts:51-62` | Listeners de documento registados fora do binding do Angular, com o comentário a explicar que um `@HostListener` provocaria um ciclo de CD global por clique numa app *zoneless*. Correto e bem justificado. |
| `_mixins.scss:24-30` | O shimmer dos esqueletos respeita `prefers-reduced-motion`, com nota sobre o refresh driver do Firefox. |
| `item-book.component.ts:136-147` | O efeito de subscrição usa `onCleanup` para cancelar corretamente. O problema em P-02 é o volume, não a gestão de ciclo de vida. |

---

## 7. Backlog priorizado

| Pri | Item | Esforço | Coortes | Tipo |
|---|---|---|---|---|
| 1 | **P-01** — `countFromIndex` (ou flag no store `books`) em `isBookDownloaded` | XS | Todas | Perf |
| 2 | **P-02** — `distinctUntilChanged` + `shareReplay`, ou sinal no serviço | S | Todas | Perf |
| 3 | **U-02 + U-01** — botão de ações explícito no card + padrão APG de menu | M | Tablet, Comutador | A11y/UX |
| 4 | **P-03** — não diferir os 4 primeiros cards; avaliar `hydrate on viewport` | S | Celular | Perf/LCP |
| 5 | **P-04** — `IMAGE_LOADER` + `sizes` | M* | Celular | Perf |
| 6 | **U-03** — contagem de referências no `BodyScrollService` | XS | Todas | Correção |
| 7 | **U-04 + U-05** — botão remover visível em toque e fora da âncora | S | Celular, Tablet | A11y/UX |
| 8 | **U-07** — abrir o menu de imediato; `.catch` na promessa | XS | Todas | UX |
| 9 | **U-06** — remover truncagem em JS; `-webkit-line-clamp`; `title` completo | S | Tablet | UX |
| 10 | **P-06** — mover a orquestração de download para o serviço, com cancelamento | M | Todas | Arquitetura |
| 11 | **U-08, P-08** — feedback de paginação e `skeletonCount` alinhado | XS | Celular | UX/CLS |
| 12 | **P-05** — virtualização com `cdk-virtual-scroll` (opcional após 1 e 2) | L | Todas | Perf |
| 13 | **P-07, U-09, U-10, U-11, §3.1** — bindings, ARIA, duplicação de chunk | S | — | Qualidade |

Os itens 1, 2, 6 e 8 são todos XS–S, somam cerca de duas horas, e cobrem os dois achados críticos
de performance e dois defeitos funcionais. São o ponto de partida.

---

## 8. Observação estrutural

Os dois achados críticos de performance — P-01 e P-02 — têm a mesma causa: **`ItemBookComponent`
fala diretamente com o `DownloadService`**, uma vez por instância. Um componente de item de lista
tornou-se um cliente de base de dados e um subscritor de estado global, e o custo passou a escalar
com o comprimento da lista.

O mesmo componente também orquestra o download completo de um livro (P-06), abre modais, dispara
notificações e injeta o `Router` e a `Location`. São 449 linhas e sete serviços num componente cuja
responsabilidade é desenhar um card.

A correção estrutural é conhecida e não é grande: um `BookDownloadState` como sinal derivado no
`DownloadService` (um `Map<bookId, estado>` calculado uma vez), consumido pelos cards com um
`computed`. Isso elimina as N consultas de P-01, as N subscrições de P-02, e dá a P-06 um dono
natural. Nenhuma das correções prioritárias depende dessa refatoração — mas todas ficam mais
simples depois dela.

---

## 9. Riscos e o que falta verificar

1. **Nenhum número de tempo, memória ou re-render foi medido.** Confirmar P-01 com um trace de
   IndexedDB no carregamento da `library` com livros descarregados, e P-02 com um trace de 5 s
   durante um download ativo numa grelha de 40 cards.
2. **O comportamento de Blobs no IndexedDB varia entre motores.** O custo real de P-01 pode ser
   substancialmente maior no WebKit (perfil Tablet) do que no Chromium. A correção é barata de
   qualquer forma.
3. **Suporte da API a variantes de imagem não verificado** — bloqueia P-04, tal como no relatório
   dos leitores. É a mesma dependência, e vale resolvê-la uma vez para os dois módulos.
4. **U-02 baseia-se no comportamento conhecido do Safari iOS quanto a `contextmenu`** — deve ser
   confirmado num iPad real antes de dimensionar a correção.
5. **A duplicação de chunk em §3.1 não foi diagnosticada até à causa raiz** — sabe-se que existe,
   não se sabe ainda qual fronteira de import a provoca.
