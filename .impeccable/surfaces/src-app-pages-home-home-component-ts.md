---
version: 1
slug: "src-app-pages-home-home-component-ts"
primary_target: "src/app/pages/home/home.component.ts"
related_targets: ["src/app/pages/latest-reads/latest-reads.component.ts"]
---

# Surface brief: home

**Mode: Operate.** Nobody needs persuading — this is an invite-only library and the visitor already
belongs here. Success is getting back into a book, or finding one, with the fewest decisions.
Scanability and density outrank expression. The world is fixed by `DESIGN.md` ("The Cheap Weekly");
this brief owns composition only.

## Direction contract

Carry these six blocks verbatim into the opening HTML comment of the built artifact, as the first
child of the document body.

- **THESIS:** One lead story, then columns. Home is a front page, not a storefront. It refuses the
  category default — a rotating hero carousel over horizontal cover shelves — and replaces it with
  a fixed lead plate and ruled columns that can be scanned in one pass.
- **OWN-WORLD:** Two-ink press on tinted stock. Press-black ground (`#12100e`), Jump Orange
  (`#f18522`) at full strength in bands and marks only, Newsprint (`#e8d8c3`) type. Archivo Black
  for the lead title, Archivo Narrow caps tracked `0.08em` for every label and running head,
  Manrope for synopses. Square cuts, hairline rules, no shadow, no glass, no blur.
- **STORY:** The visitor understands within one viewport what they were reading, what changed since
  they last looked, and what is new — in that order, because resuming beats discovering.
- **FIRST VIEWPORT:** A masthead band with the product name and today's date, hairline-ruled at the
  bottom. Directly beneath it, the "última hora" band: a solid Jump Orange strip carrying the
  series and chapter the visitor stopped on, with its state mark. Below that, the lead plate — the
  featured book at full column width, cover cut square and flush, title in Archivo Black, one
  synopsis paragraph, primary action as a printed orange band. Then the continue-reading rack: a
  horizontal run of square-cut covers, each with a Jump Orange progress rail beneath it. Below the
  fold, two ruled columns: recent updates on the left, new arrivals on the right.
- **FORM:** The Front Page. Candidate 2 of the grounded list, dealt by the roll and locked by the
  user over The Serial Calendar and The Wall. Seed key `5d15a89b`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the
  verdict, DESIGN.md, and every shipping raster carrying its provenance.

## The carousel becomes an edition

**This is a behavior change and needs confirmation before it is built.** A front page has a fixed
lead; a lead that rotates on a timer contradicts the structure and is also an accessibility and
performance cost the product does not need. The resolution: the featured set becomes an **edition**.
One book holds the lead for the whole visit. The remaining featured books demote to the head of the
updates column as secondary chamadas, each a ruled row with a small cover chip.

If the rotation is load-bearing for a product reason not in `PRODUCT.md`, the fallback is a manual
edition switch — press marks in the masthead, no timer, no auto-advance — never a re-instated
auto-rotating carousel.

## The continue-reading rack

Added on review. The first pass expressed "resume" as a text band alone, which cost the surface the
one thing the incumbent home did well: browsing by cover. The band answers *what was I reading*;
the rack answers *what am I in the middle of*, and it has to do it with images.

- Covers are square-cut, 2:3, 96px wide at 390px and 128px at 1440px, scrolling horizontally with
  the last one deliberately cut by the frame edge so the run reads as continuing.
- Each cover carries a 3px Jump Orange progress rail directly beneath it — the same registration
  rail from the chapter reader, at rack scale. One motif, two scales: position is always an orange
  rail in this system.
- Title and `CAP. n · nn%` print under the rail in Manrope and Archivo Narrow.
- The rack renders from local state, so it is the part of home that works with no network at all.

## Visitor path

1. The masthead confirms where they are and how current the page is.
2. The "última hora" band answers "what was I reading" before any scrolling.
3. The lead plate answers "what should I read next" with one committed recommendation.
4. The columns answer "what changed" and "what's new" in one scan.
5. Anything deeper routes to `/books` with the query already applied — the columns' "ver tudo"
   affordances are folios at the column foot, not buttons.

## Required states

- **Nothing in progress:** neither the "última hora" band nor the continue-reading rack prints at
  all. The masthead sits directly on the lead plate. No empty placeholder, no "you haven't started
  anything" copy occupying furniture reserved for real news.
- **Loading:** unprinted plates — the existing skeleton treatment restyled to square cuts and ink
  density. Skeletons hold the exact final geometry so nothing reflows when content lands.
- **Empty catalog:** the lead plate carries the empty state and teaches the interface. This is a
  first-run condition for a self-hosted instance with nothing scraped yet, so it must say what to
  do next, not "nothing here".
- **Offline:** the columns filter to held content and the masthead prints an offline mark. The page
  must render fully with no network — it is the visitor's own library, and this is the product's
  whole premise.
- **Sensitive content:** never appears in the lead, in either column, or in the edition set unless
  the visitor has explicitly enabled it. This is non-negotiable.

## Device tiers

Detect `deviceMemory`, `hardwareConcurrency`, `saveData`, `prefers-reduced-motion`.

- **Full press:** the lead plate and bands print in on first paint (120ms, staggered by one beat);
  cover chips decode progressively behind their blurhash.
- **Middle:** no print-in; state changes swap ink density instead of animating.
- **Floor:** everything renders in final position immediately. Nothing is missing, only quiet.

Home is a launchpad. No orchestrated load sequence — the visitor came to leave this page quickly.

## Out of scope

The books listing (own brief), the chapter reader (own brief), header and global navigation.
