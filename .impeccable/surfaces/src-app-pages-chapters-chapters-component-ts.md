---
version: 1
slug: "src-app-pages-chapters-chapters-component-ts"
primary_target: "src/app/pages/chapters/chapters.component.ts"
related_targets: ["src/app/features/reading/components","src/app/pages/book/book.component.ts"]
---

# Surface brief: the chapter reader

**Mode: Experience.** The visitor is inside the work itself. The manga page leads from the first
viewport and the interface recedes. Every decision on this surface is judged by whether it got out
of the artwork's way.

This is the surface the visual world was chosen to prove. See `DESIGN.md` ("The Cheap Weekly").

## Direction contract

Carry these six blocks verbatim into the opening HTML comment of the built artifact, as the first
child of the document body, and grep the production build for the seed key afterwards.

- **THESIS:** The weekly nobody was supposed to keep, kept forever. This reader refuses the
  category default — a near-black shell with an auto-hiding top bar and a floating action button
  — and replaces persistent chrome with a single 6px printed rail.
- **OWN-WORLD:** Two-ink press on tinted stock. Press-black ground (`#12100e`), Jump Orange
  (`#f18522`) at full strength in bands and marks only, Newsprint (`#e8d8c3`) type. Archivo Black
  mastheads, Archivo Narrow caps tracked `0.08em` for every label, Manrope for sentences. Square
  cuts, hairline rules, no shadow, no glass, no blur.
- **STORY:** The reader resumes chapter 47 in the dark with no signal, reads without ever seeing a
  control, and understands at a glance that this chapter is held on their own device and will
  still be here when the source is not.
- **FIRST VIEWPORT:** Full-bleed page plate on press black, artwork edge to edge. A 6px Jump Orange
  registration rail pinned to the leading edge, filled to reading position — the only persistent
  chrome. No masthead, no bar, no button. On tap: a masthead band prints down from the top in
  120ms carrying series name and chapter number in Archivo Black, and a strip of page thumbs on
  tinted stock prints up from the bottom. Tap again and both lift off.
- **FORM:** The Cheap Weekly — Weekly Shonen Jump pulp newsprint. Candidate 3 of the grounded list,
  assigned by the roll. Seed key `3a44bd1d`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the
  verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Visitor path

1. Arrives from the book page or from a resume affordance, already knowing what they want.
2. The page is on screen before any chrome exists. Reading position is restored silently.
3. Reading is uninterrupted: the rail fills, nothing else moves.
4. On demand, chrome prints in for navigation, page jump, or settings, then lifts off.
5. At the chapter end, the next-chapter plate prints in — the one moment the surface asks for a
   decision, and the one moment the cat silhouette appears against the rail.

## Signature interaction: the press pull

Chrome does not fade. It **prints**: a 120ms ink impression on a boundary, masthead down and thumb
strip up together, and it **lifts** the same way. Nothing cross-dissolves, nothing eases for 300ms,
nothing appears mid-page while the reader is reading. A chrome change is announced before it lands.

## The cat

Black on black, printed in the margin, legible only where the silhouette crosses the orange rail.
It appears when the reader finishes a chapter and when a chapter finishes downloading — the two
moments something was completed. It is never ambient, never animated on a loop, never decorative.
Light and shadow doing a job.

## Required states

Each carries a mark in the Label face; colour reinforces, never replaces.

- **Held offline** (`■ HELD`) — the default success state and the product's whole reason for being.
- **Pulling** (`▶ PULLING`) — chapter downloading, with real progress on the rail.
- **Not held** (`▲ NOT HELD`) — readable now over the network, not yet retained.
- **Stale** (`▨ STALE`) — held, but the source has newer pages.
- **Source dead** (`✕ SOURCE DEAD`) — upstream is gone and this copy is the only one. This state
  must feel like reassurance, not like an error.
- **Offline, not held** — the honest dead end. A real designed state with a route back to the
  library, never a toast.

## Device tiers

The cat knows the device. Detect `deviceMemory`, `hardwareConcurrency`, `saveData`, and
`prefers-reduced-motion`; none of this exists in the codebase today.

- **Full press:** the print-in impression, rail inertia settling on page pitch, the cat silhouette.
- **Middle:** motion substituted by texture — state changes swap ink density instead of animating.
- **Floor:** marks only. Instant chrome, no transition, no silhouette. Nothing is missing, only quiet.

Reading never pays for delight. If an effect can cost a frame during a page turn, it belongs to
the full tier or to nothing.

## Out of scope

Reader settings panels, the library grid, and the dashboard inherit this world but are separate
surfaces with their own briefs.
