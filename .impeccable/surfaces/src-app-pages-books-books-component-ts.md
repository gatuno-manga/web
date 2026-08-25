---
version: 1
slug: "src-app-pages-books-books-component-ts"
primary_target: "src/app/pages/books/books.component.ts"
related_targets: ["src/app/features/books/components/book-filter/book-filter.component.ts","src/app/shared/ui/organisms/book-grid/book-grid.component.ts"]
---

# Surface brief: books listing

**Mode: Operate.** The visitor is filtering a catalog toward a specific thing. Eight filter
dimensions, two list modes, and an offline mode are the real subject of this page. Density,
scanability, and legible state outrank expression. The world is fixed by `DESIGN.md`
("The Cheap Weekly"); this brief owns composition only.

## Direction contract

Carry these six blocks verbatim into the opening HTML comment of the built artifact, as the first
child of the document body.

- **THESIS:** Covers lead, and the filter set is printed, not hidden. It refuses the category default
  — a cover grid with a filter drawer that conceals its own state — by keeping the grid and putting
  the entire active filter set on the page as press marks.
- **OWN-WORLD:** Two-ink press on tinted stock. Press-black ground (`#12100e`), Jump Orange
  (`#f18522`) at full strength in bands and marks only, Newsprint (`#e8d8c3`) type. Archivo Narrow
  caps tracked `0.08em` for every label, column head, and state mark; Manrope for titles and author
  names. Square cuts, hairline rules, no shadow, no glass, no blur.
- **STORY:** The visitor always knows exactly what is filtering their results and what they still
  hold offline, and can scan fifty rows without moving their eyes off one column.
- **FIRST VIEWPORT:** A filter band across the top — every active filter printed as an Archivo
  Narrow caps mark on a hairline-ruled strip, orange for includes, ink-rule for excludes, rose
  stock for the sensitive-content boundary. Each mark dismisses itself. Under it a density control
  (GRADE · ÍNDICE), then the results as a square-cut cover grid: 3 columns at 390px, 8 at 1440px,
  each cover 2:3 and flush, carrying its title and its retention mark directly beneath. The covers
  are the navigation.
- **FORM:** The Index Page. Candidate 6 of the grounded list, assigned by the roll and locked by the
  user over The Classified Columns and The Rail and Grid. Seed key `fa4b8b2d`. **Corrected after
  review:** the user judged the index's cover suppression a real loss against the incumbent, so the
  cover grid became the primary view and the index survives as the alternate density. The filter
  band — the part of the structure that solved the actual problem — is unchanged and now serves
  both densities.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the
  verdict, DESIGN.md, and every shipping raster carrying its provenance.

## How the filters actually work

Eight independent dimensions, one control vocabulary. The rules below are the specification, not a
suggestion.

### The tri-state chip

Every value in `tags`, `authors`, and `type` is one chip carrying three states, cycled by repeated
activation: **neutral → include → exclude → neutral**.

| State | Rendering | Meaning |
|---|---|---|
| Neutral | Hairline Ink Rule border, Stock Muted caps | Not part of the query |
| Include | Solid Jump Orange plate, Press Black caps | Must match |
| Exclude | Hairline border, Stock Muted caps, **struck through** | Must not match |

This is what makes eight dimensions fit one panel instead of eight screens, and it removes the
separate `excludeTags` control the incumbent needs. Strike-through carries exclusion, so the meaning
survives every stock and colour-blindness. Keyboard: `Space` cycles forward, `Shift+Space` cycles
back, so a chip is never a trap.

### Logic is printed, never implied

`tags`, `excludeTags`, and `authors` each own an AND/OR toggle rendered beside their section head as
`TODAS · E` / `QUALQUER · OU`. A visitor who cannot tell AND from OR cannot trust the result count,
so the logic is never a hidden default and never a shared global.

### Per-dimension controls

| Dimension | Icon | Control |
|---|---|---|
| `search` | `search` | Text field; matches title, author, tag |
| `type` | `layers` | Tri-state chips (mangá, manhwa, manhua, novel) |
| `tags` / `excludeTags` | `tag` | Tri-state chips + AND/OR toggle |
| `authors` | `user` | Tri-state chips + AND/OR toggle |
| `publication` | `hash` | Operator segment (`≤` `=` `≥`) + year |
| `sensitiveContent` | `eye-off` | Rose-stock gate, off by default |
| `orderBy` / `order` | `chevron-down` | Single-select chips |

### Where the controls live, by width

- **<900px** — a full-height sheet over the results. The band at the top of the page stays as the
  state readout while the sheet is closed.
- **900–2400px** — the same sheet, opened from the filter icon; the band remains the readout.
- **≥2400px** — the sheet **docks**. It becomes a permanent 380px panel on the trailing edge and the
  top band retires, because a summary of controls that are permanently visible is noise. This is
  what the ultrawide width is spent on.

### Sensitive content

The gate is rose stock, off by default, and it is the only rose on the surface. Enabling it is an
explicit gesture that never persists silently across accounts or devices without the user's action.
Sensitive titles never enter featured, search, recommendation, or result counts while it is off —
the count itself must not leak their existence.

### Offline mode

When `viewMode` is `offline`, the online-only dimensions (`type`, `tags`, `authors`, `publication`)
**visibly retire** — dimmed to Ink Rule with their controls inert — rather than silently doing
nothing. `search` and `sensitiveContent` keep working. The panel head prints `ACERVO LOCAL`. A
filter that appears live but is ignored is the worst of the three options.

### Result feedback

The result count sits with the controls and updates as the query changes. Zero results keeps the
entire filter state printed and names the most likely culprit dimension with a one-tap drop.

## The filter band is the state

The page's hardest problem is that eight independent dimensions can be active at once — `type`,
`tags` with AND/OR logic, `excludeTags` with its own logic, `authors` with logic, `publication` with
a comparison operator, `orderBy`/`order`, `search`, and `sensitiveContent` — and today a visitor
cannot tell what is applied without opening the filter component.

The band fixes that and is the single most important element on the page. Rules:

- Every active filter prints a mark. No filter is applied invisibly.
- Logic is printed, not implied: `TAGS: AÇÃO + DRAMA` for AND, `AÇÃO / DRAMA` for OR. A visitor who
  cannot tell AND from OR cannot trust the result count.
- Excludes print with a strike mark and ink-rule colour, never as a second orange.
- The sensitive-content boundary prints in rose stock — the one place that stock is used on this
  surface.
- The band wraps to as many lines as it needs. It is never truncated, never collapsed behind a
  counter, never scrolled horizontally. Truncating the state to save space is the failure this
  structure exists to prevent.
- Clearing everything is a folio-style action at the band's end, not a floating button.

## Navigation is recognised, not read

Per `DESIGN.md`'s Icon-First Rule: destinations and retention states lead with an icon. On this
surface that means the density control is `grid` / `list` rather than the words GRADE / ÍNDICE, and
every cover carries its retention state as an icon (`circle-check`, `loader`, `download`,
`refresh-ccw-dot`, `refresh-cw-off`) with the word as a small backup. A visitor scanning 100 covers
should read zero sentences to know what they hold.

## Two densities

The index was locked, then corrected on review: suppressing covers cost more than the density
bought. Whatever else the incumbent got wrong, it did not get images wrong, and a reader who can
only navigate by what they are already reading has lost the catalog.

So the page ships two densities behind one control, and the filter band sits above both.

- **GRADE (default).** Square-cut covers, 2:3, flush, no rounding. 3 columns at 390px, 8 at 1440px.
  Title and retention mark print directly under each cover — state stays legible without a hover,
  which is what makes a grid usable for a library that is partly offline.
- **ÍNDICE (alternate).** The dense ruled table: title, author, tags, chapter count, updated, state.
  For known-item search and for filtering a thousand rows, where covers genuinely slow the task.

The control is the existing list-mode `app-select-cycle`, extended — not a new page and not a
hidden mode. Density is a user preference and must persist per user.

The remaining honest risk sits on the other side now: a cover grid is the category default, so the
world has to carry the distinction. It does that through the printed filter band, square cuts, the
state marks, and press typography — never through decoration laid over the artwork.

## Both list modes

- **Pagination:** page numbers set as folios at the foot, Archivo Narrow caps, current page as a
  solid orange band. The existing top pagination is retired — the filter band owns the top edge.
- **Infinite scroll:** the column simply continues, and each page boundary prints a hairline folio
  rule carrying the page number. The visitor never loses their place in a thousand-row column, and
  the existing scroll-restoration logic gets a real anchor to restore to.

## Required states

- **Loading, first page:** unprinted rows holding exact final geometry. Never a spinner.
- **Loading, subsequent page:** the folio rule prints with a pulling mark; existing rows never move.
- **Empty result:** the band stays fully printed — the visitor must see which filters produced zero
  — and the empty state names the most likely culprit filter and offers to drop it.
- **Offline mode:** the band prints a `■ ACERVO LOCAL` mark and the online-only filters visibly
  retire rather than silently doing nothing. Which filters still work offline must be legible.
- **Offline and nothing held:** a designed state with a route back, never a toast.
- **Per-row retention:** every row ends with a state mark from `DESIGN.md` — `■ HELD`,
  `▶ PULLING`, `▲ NOT HELD`, `▨ STALE`, `✕ SOURCE DEAD`.

## Device tiers

Detect `deviceMemory`, `hardwareConcurrency`, `saveData`, `prefers-reduced-motion`.

- **Full press:** rows print in on a boundary as a page lands; filter marks print and lift.
- **Middle:** no print-in; density swap only.
- **Floor:** immediate render, no transitions. A thousand-row list must never pay for animation.

Row rendering is the performance-critical path on this page. Whatever tier is active, a row is a
hairline rule, two text runs, one small image, and one mark — nothing that composites a layer.

## Out of scope

The book detail page, the chapter reader (own brief), the filter component's internal UI beyond how
its result prints in the band.
