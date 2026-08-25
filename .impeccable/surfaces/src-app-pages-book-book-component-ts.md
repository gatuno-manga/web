---
version: 1
slug: "src-app-pages-book-book-component-ts"
primary_target: "src/app/pages/book/book.component.ts"
related_targets: ["src/app/features/books/components/chapter-group/chapter-group.component.ts","src/app/features/books/components/info-book/info-book.component.ts"]
---

# Surface brief: book detail page

**Mode: Operate.** The visitor arrives to make one decision — which chapter to open — and to check one
fact: what they still hold offline. Everything else on the page serves those two. The world is fixed
by `DESIGN.md` ("The Cheap Weekly"); this brief owns composition only.

## Direction contract

- **THESIS:** The page is a colophon. Cover, then data, then summary — every row ruled. It refuses the
  category default (a full-bleed cover blurred into a hero with a glass panel floating on it) and
  treats metadata as first-class printed content instead of decoration over artwork.
- **OWN-WORLD:** Two-ink press on tinted stock. Press-black ground (`#12100e`), Jump Orange
  (`#f18522`) in bands and marks only, Newsprint (`#e8d8c3`) type. Archivo Black for the title and
  chapter numbers, Archivo Narrow caps tracked `0.08em` for every label, Manrope for synopsis and
  chapter titles. Square cuts, hairline rules, no shadow, no glass, no blur.
- **STORY:** The visitor sees the cover as artwork, learns the four facts that decide whether to read,
  and reaches the chapter they want without hunting.
- **FIRST VIEWPORT:** Back affordance, hairline. Then the ficha: cover at its **real file aspect** on
  the leading edge, kicker (type · status · language), title in Archivo Black, synopsis, and the
  action row — `CONTINUAR — CAP. n` as a solid orange band followed by outlined icon actions
  (favoritar, acompanhar, baixar, mais). Below it a ruled six-cell data block (capítulos, lançamento,
  atualizado, autor, estado, tamanho local), then tags, then `SUMÁRIO — n CAPÍTULOS`.
- **FORM:** A Ficha da Edição. Candidate 3 of the grounded list, dealt by the roll and locked by the
  user over A Linha do Tempo and Duas Colunas Fixas. Seed key `0ccf4c9a`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the
  verdict, DESIGN.md, and every shipping raster carrying its provenance.

## The cover is the exception

Everywhere else in the product a cover is normalised to a 2:3 box. **Here it is not.** The page already
reads `coverMetadata.width / height` into `--book-aspect-ratio` and falls back to `2 / 3`; that is
correct and stays. This is the one surface where the artwork is the subject rather than a wayfinding
token, so it is shown at the ratio it was drawn at. It is still never cropped to a banner, never
rounded, never used as a blurred full-bleed background.

The incumbent `aurora-scene` + `background-container` blurhash wash behind the panel is retired with
the rest of Aurora.

## The locked structure's honest cost

The roll's own risk line applies: putting the data block above the summary pushes chapters below the
fold, and most visits are returning readers who already know the metadata. Two mitigations are part
of the design:

- The primary action is `CONTINUAR — CAP. n`, resolved from reading progress. The returning reader
  never needs to reach the summary at all.
- The data block is one ruled row of six cells, not a stacked definition list. It costs roughly 70px,
  not a screen.

If telemetry ever shows returning readers scrolling past the ficha every time, the correct move is to
collapse the data block for readers with progress — not to reorder the page per visitor.

## Required states

- **Not logged in:** the action row collapses to the single primary action (`single-action`), and
  favoritar / acompanhar / baixar do not render as disabled ghosts.
- **Never opened:** primary action reads `LER — CAP. 1`.
- **Partially read:** `CONTINUAR — CAP. n`; every chapter at or below the read point carries a `LIDO`
  outline mark and drops its number and title to Stock Muted.
- **Per-chapter retention:** every summary row ends with its state icon — `circle-check` guardado,
  `loader` puxando, `download` não guardado, `refresh-ccw-dot` desatualizado, `refresh-cw-off` fonte
  morta.
- **Whole-book download:** the data block's `ESTADO` cell carries the aggregate, with local size beside
  it. Downloading shows real progress, not a spinner.
- **Offline:** chapters that are not held render inert with `download` struck; the page itself must
  render fully from local data.
- **Admin (`internal:books:edit`):** the admin actions live inside `mais`, never as a visible extra
  row for readers.
- **Loading:** skeleton holds the exact final geometry — cover box at the known aspect, six data cells,
  ruled chapter rows. Never a spinner.
- **Sensitive title:** if the book carries a sensitive category the user has not allowed globally, the
  page is not reachable. There is no teaser state.

## Device tiers

- **Full press:** ficha prints in on load (120ms, one beat), hover lifts chapter rows 4px with an
  orange hairline.
- **Middle:** no print-in; hover is a density change only.
- **Floor:** immediate render, no transitions.

A title can carry more than a thousand chapters. The summary is virtualised at every tier, and a
chapter row must stay a hairline, two text runs and one icon — nothing that composites a layer.

## Out of scope

The chapter reader (own brief), the books listing (own brief), review authoring, and the admin
editing flows behind `mais`.
