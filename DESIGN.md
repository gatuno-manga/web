---
name: Gatuno
description: The weekly nobody was supposed to keep, kept forever.
colors:
  press-black: "#12100e"
  ink-plate: "#1c1a17"
  ink-rule: "#4a453e"
  jump-orange: "#f18522"
  orange-deep: "#cc5e00"
  newsprint: "#e8d8c3"
  stock-muted: "#9a9086"
  rose-stock: "#c8556c"
typography:
  masthead:
    fontFamily: "Archivo Black, Archivo, Impact, sans-serif"
    fontSize: "clamp(1.75rem, 6vw, 3rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "clamp(1.125rem, 3vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  plate: "0"
  cut: "2px"
  touch: "6px"
spacing:
  hair: "1px"
  gutter: "8px"
  column: "16px"
  spread: "32px"
components:
  button-primary:
    backgroundColor: "{colors.jump-orange}"
    textColor: "{colors.press-black}"
    typography: "{typography.label}"
    rounded: "{rounded.cut}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.newsprint}"
    textColor: "{colors.press-black}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.newsprint}"
    typography: "{typography.label}"
    rounded: "{rounded.cut}"
    padding: "12px 20px"
  plate:
    backgroundColor: "{colors.ink-plate}"
    textColor: "{colors.newsprint}"
    rounded: "{rounded.plate}"
    padding: "16px"
  registration-rail:
    backgroundColor: "{colors.jump-orange}"
    width: "6px"
  input:
    backgroundColor: "{colors.ink-plate}"
    textColor: "{colors.newsprint}"
    typography: "{typography.body}"
    rounded: "{rounded.cut}"
    padding: "10px 12px"
    height: "42px"
---

<!-- SEED: the world was established with the user before implementation; re-run /impeccable document once the reader ships to capture the actual tokens and components. -->

# Design System: Gatuno

## Overview

**Creative North Star: "The Cheap Weekly"**

Weekly Shōnen Jump is printed on the worst paper in publishing. Tinted pulp, halftone dots you can count, ink that comes off on your hands, a masthead screaming in condensed gothic. It is designed to be read on a train and thrown away by Friday. Gatuno is the product that keeps it. That contradiction — the disposable object treated as permanent — is the whole system. The interface is press furniture: mastheads, registration rails, stock, marks. The artwork is what was printed. Nothing in the chrome may act like it is the thing you came for.

The reading scene decides the ground. One reader, lights off, in bed at one in the morning, phone at arm's length, resuming chapter 47 with no signal. That forces ink, not paper: the surface is press-black by default and the tinted stock appears in narrow fields — a masthead band, a page-thumb strip, a state mark — never as a full-screen field that flashes a dark-adapted eye. Orange is not an accent color here. It is the press's second ink: it arrives at full strength in bands and marks, or it does not arrive.

This world replaces Aurora Glassmorphism, which is retired. Aurora was reaching for the right idea — light and shadow, a black cat that disappears and reappears when needed — through blurred floating orbs and stacked glass. The idea survives; the execution does not. In this system the cat is not ambience. It is a silhouette printed in black on black, legible only where it crosses the orange rail, and it appears at the moments the reader has finished something.

**Key Characteristics:**
- Ink-dominant ground; no true white anywhere in the product.
- Orange at press strength, in bands and marks, never as a glow or a tint.
- Square cuts. Newsprint is guillotined, not rounded.
- No glass, no shadow, no backdrop-filter. Depth is registration offset and ink density.
- State is a mark, not a hue — so it survives every stock.
- Chrome prints in and lifts off; it never fades.
- The artwork always outranks the interface.

## Colors

A two-ink press — black and orange — pulling on tinted stock.

### Primary
- **Jump Orange** (`#f18522`): the second ink. Masthead bands, the registration rail, the committed state mark, the primary action. It is the product's identity and the one color permitted at full saturation across a whole region.
- **Deep Press Orange** (`#cc5e00`): the same ink on light stock, where the bright orange loses contrast against paper.

### Tertiary
- **Rose Stock** (`#c8556c`): the tinted signature page. Jump prints sections on colored pulp; this is that section. Reserved for one thing per surface — the sensitive-content boundary, the "you are here" marker — never decoration.

### Neutral
- **Press Black** (`#12100e`): the ground. Warm ink black, never blue-black — blue-black is the generic dark app this system refuses.
- **Ink Plate** (`#1c1a17`): a plate laid on the ground. Cards, sheets, input wells. Distinguished from the ground by density, not by shadow.
- **Ink Rule** (`#4a453e`): rules, cut edges, dividers, hairlines between columns.
- **Newsprint** (`#e8d8c3`): the stock. Primary text on ink, and the paper field of a light stock.
- **Stock Muted** (`#9a9086`): secondary text, running heads, colophon detail.

### Named Rules

**The Ink Ground Rule.** There is no true white (`#ffffff`) anywhere in the product. The lightest value in a reading surface is Newsprint (`#e8d8c3`), and at night stock never covers more than a quarter of the viewport. A reader in the dark should never be flashed by their own library.

**The Second Ink Rule.** Orange is press ink, not an accent. It appears at full opacity in solid bands and marks, or not at all. Orange at 20% under a surface, orange as a glow, orange as a border tint: all are the previous system, and all are defects here.

**The Stock Rule.** Themes are paper stocks, not color schemes. `light` is white stock, `dark` is press black, `true-dark` is pure ink, `dracula` and `slate` are tinted stocks. Every one of them keeps the same two inks; only the paper changes. Personalization is a product requirement, so a rule that only works on one stock is a broken rule.

## Typography

**Display Font:** Archivo Black (with Archivo, Impact, sans-serif)
**Headline / Label Font:** Archivo Narrow (with Archivo, sans-serif)
**Body Font:** Manrope (with system-ui, sans-serif)

**Character:** A newsprint masthead and the text under it. Archivo is a grotesque built from American gothic newsprint types — heavy, condensed, made to be printed badly on cheap stock and still shout. Manrope carries running text because it was already here, is already self-hosted, and reads cleanly at 12px on a phone. The pairing is press, not literature: nothing in this system is set in a serif.

Inknut Antiqua and Plus Jakarta Sans are retired. Inknut is a Devanagari-rooted display serif with no relationship to this world; Plus Jakarta Sans is the interface default this system exists to avoid. Epilogue is retired as redundant. All faces stay self-hosted — offline-first means the type ships with the app.

### Hierarchy
- **Masthead** (900, `clamp(1.75rem, 6vw, 3rem)`, 0.95, -0.02em): the chapter number, the series name at the top of a plate. One per screen.
- **Headline** (700, `clamp(1.125rem, 3vw, 1.5rem)`, 1.1): section heads, book titles in a list, dashboard group titles.
- **Body** (400, 1rem, 1.55): synopses, reviews, settings copy, everything read in sentences. Max measure 68ch.
- **Label** (700, 0.75rem, 0.08em, uppercase): every control, badge, running head, state mark, and metadata field.

### Named Rules

**The Condensed Caps Rule.** Every label, badge, button, and state mark is Archivo Narrow, uppercase, tracked `0.08em`. A sentence-case control label is a defect. This is what makes a dense screen scan as printed furniture instead of as an app.

**The Icon-First Rule.** Where a control has a recognisable icon, the icon carries it and the caps label shrinks to a `7–8px` backup beneath. The two rules do not conflict: caps govern how a label is *set*, this rule governs whether the reader has to *read* it. Navigation, retention state, and filter dimensions are all recognised by icon; only ambiguous or destructive actions lead with the word.

**The One Press Rule.** Two families ship: Archivo and Manrope. A third face requires the same justification as a new dependency.

## Layout

The page is a press sheet: a fixed measure, hard columns, and rules where columns meet. Content sits in a 12-column grid at `16px` gutters on desktop, collapsing to a single column with `16px` margins below 768px, where the root font drops to 12px (already the incumbent behavior and worth keeping — it buys real density on a phone).

Spacing is a press rhythm, not a scale of soft steps: `1px` hairlines, `8px` gutters between related furniture, `16px` between columns and stacked plates, `32px` between sections of the sheet. Nothing between these values.

Density is high by intent. This is a catalog product read by people who know what they are looking for; generous whitespace here reads as an empty shelf, not as calm. The reader surface is the opposite and the only exception: it is full bleed, and everything that is not the artwork is off the screen until asked for.

Breakpoints follow what the code already uses: 480px, 600px, 768px (the primary), 900px, 1200px container max — plus one the codebase never considered.

**Ultrawide (≥2400px).** The layout does not stretch and it does not simply add columns forever. Past 2400px the extra width buys **structure, not scale**: the icon rail stays fixed at 84px, the result grid caps its cover at 200px and takes the columns that fit, and the filter drawer stops being a drawer — it docks as a permanent 380px panel on the trailing edge. Reading measure never exceeds 68ch no matter how wide the monitor. A 3440px display should feel like a broadsheet with its own index, not like a phone layout that was pulled apart.

**The Broadsheet Rule.** Every surface names what the extra width *becomes* before it is allowed to use it — another column, a docked panel, a wider cover — and anything that would simply grow instead stays at its cap.

## Elevation & Depth

**This system has no shadows and no glass.** No `box-shadow`, no `backdrop-filter`, no translucent panels. Depth comes from two press facts: **ink density** (a plate is a denser black than the ground, `#1c1a17` on `#12100e`) and **registration offset** (a layer that sits above another is offset by 2–4px and cut square, the way an off-register color plate shows its edge).

This is a hard requirement, not a preference. Stacked `backdrop-filter` and large-radius `filter: blur()` are the measured cause of jank on the low-end phones this product is read on, and the previous system's `blur(90px)` animated orbs are the specific thing being removed.

### Named Rules

**The No-Glass Rule.** `backdrop-filter` and `box-shadow` do not appear in this codebase. A floating surface earns separation with ink density, a hairline rule, and a registration offset. If a panel cannot be told apart without a shadow, it is laid out wrong.

**The Hover-Without-Shadow Rule.** The incumbent card hover is `translateY(-4px)` plus a `box-shadow`. The lift stays; the shadow is replaced by a `2px` Jump Orange hairline drawn `OUTSIDE` the cover and a step up in ink density. Elevation in this system is ink and rule, never blur.

**The Off-Register Rule.** Anything that overlays content — dropdown, menu, sheet, dialog — is offset 2–4px from the element it belongs to and cut square, so the stack reads as plates on a press bed rather than as cards floating in space.

## Shapes

Newsprint is cut with a guillotine. **Plates are square (`0`)**; the only softening is `2px` on small cut furniture (badges, chips, inputs) and `6px` on pure finger targets where a square corner is genuinely uncomfortable. The incumbent 8px/12px/16px/20px radius spread is retired.

Cover images keep their `2 / 3` aspect and are cut square — a manga cover is a printed plate, not a rounded thumbnail. Borders are hairlines in Ink Rule (`1px solid`), never doubled, never colored except where an orange band is doing work.

The one curve in the system is the reader's own content, and it belongs to the artwork.

## Components

### Buttons
- **Shape:** cut square (`2px`), never pill, never circular except icon-only touch targets.
- **Primary:** solid Jump Orange band, Press Black label, Label type, `12px 20px`. It reads as a printed band with text knocked out of it.
- **Hover / Focus:** the band inverts to Newsprint stock with a Press Black label — an ink change, not a brightness filter. Focus is `2px` solid Jump Orange at `2px` offset, and it is never removed.
- **Ghost:** no fill, Newsprint label, hairline Ink Rule border. Hover fills with Ink Plate.
- **Disabled:** the band drops to Ink Rule with Stock Muted text. No opacity fade — a faded band on a dark ground disappears.

### State marks (signature)
State never reads as hue alone, because it has to survive five stocks and colorblind readers. Every retention state carries an **icon** from the shipped Lucide set, optionally followed by a Label-face word:

| State | Icon | Colour | Why this icon |
|---|---|---|---|
| Held offline | `circle-check` | Newsprint | The chapter is secured on this device. |
| Pulling | `loader` | Jump Orange | Work in progress, the only state that may animate. |
| Not held | `download` | Stock Muted | The affordance *is* the state: it tells you what to do about it. |
| Stale | `refresh-ccw-dot` | Stock Muted | Source has newer pages; the dot is the pending change. |
| Source dead | `refresh-cw-off` | Rose Stock | Refresh is struck through — the upstream can never update again. |

Colour reinforces the icon; it never replaces it. This is the system's most product-specific component — it is how a library that outlives its sources tells you what it still actually has, without the reader parsing a sentence.

### Covers (signature)

**A manga cover is a portrait object and may never be shown as a banner.** Cropping one to a wide strip destroys the artwork and misrepresents the medium. Two rules, one per context:

- **In any grid, rack, row, or lead** — the cover sits in a fixed portrait box at **2:3**, square-cut, with `object-fit: cover` over its blurhash. Uniform boxes are what make a grid scannable; MangaDex normalises the same way (140×199, ~5:7).
- **On the book detail page** — the cover is shown at the **real aspect of the file** (`coverMetadata.width / height`, falling back to 2:3). The detail page is where the artwork is the subject, so it is never re-cropped.

Never round a cover, never shadow it, never letterbox it, and never use one as a full-bleed background strip.

### Brand mark

The mark is the Gatuno cat from `public/assets/icons/logo.svg`, knocked out in Press Black on a solid Jump Orange plate. The logo already ships in this system's two inks (`#000212`, `#F18522`), so nothing is recoloured; the orange eyes read as holes at small sizes, which is the black cat appearing and disappearing at mark scale. The turbulence filter in the source file is dropped for UI use — it does not survive at 26px and costs a filter pass.

### Plates (cards / containers)
- **Corner:** square (`0`).
- **Background:** Ink Plate on the Press Black ground.
- **Separation:** hairline Ink Rule border plus density difference. No shadow.
- **Padding:** `16px`.
- Book covers sit flush to the plate edge, full bleed, no inset.

### Inputs
- Ink Plate well, `2px` cut, hairline Ink Rule border, `42px` tall, Body type.
- **Focus:** the border becomes a `2px` Jump Orange band along the bottom edge only — an underscore ruled in ink. No glow, no ring, no shadow.
- **Error:** the bottom band turns Rose Stock and a Label-type mark prints beneath.

### Navigation

**Navigation is recognised, not read.** Every destination is an icon first; the caps label is a `7–8px` backup under it, never the primary carrier. A reader must be able to move through the product without parsing a word.

- **≥900px — the icon rail.** A fixed `72–84px` vertical rail on the leading edge: Gatuno mark, then `file-text` (início), `layers` (livros), `download` (acervo offline), `clock` (leituras), `search` (busca); `bell` and `user` pinned to the foot. The active item sits on a solid Jump Orange plate with the icon knocked out in Press Black. The rail never scrolls and never collapses.
- **<900px — the icon tab bar.** The same five primary destinations as a `62px` bottom bar, `21px` icons, hairline Ink Rule top edge, active item on the same orange plate.
- The masthead keeps only page identity and counts. The incumbent `--degrader` gradient and its `2px` solid text-color border are retired.

Every icon carries an `aria-label` and a tooltip on pointer devices. Icon-only is never used for a destructive or irreversible action — those keep their word.

### Icons

One family: the shipped Lucide set in `public/assets/icons` (74 faces), `2px` stroke, `currentColor`, `round` caps and joins. Sizes: `24px` rail, `21px` tab bar, `18px` controls, `14–15px` inline state, `12px` dense rows. No second icon style, no filled variants, no emoji — the emoji-presentation glyph is the specific defect this rule replaced.

Icons inherit their meaning from the product, not from decoration: `download` always means retention, `refresh-*` always means the source relationship, `eye-off` always means the sensitive-content boundary.

### The registration rail (signature)
A `6px` Jump Orange rail pinned to the leading edge of the chapter reader, filled to reading position. It is the only chrome that persists while reading. It doubles as the scrubber, it is the one element the cat silhouette is legible against, and it is how the reader knows where they are without anything covering the page.

## Do's and Don'ts

### Do:
- **Do** keep the artwork the brightest, largest, most saturated thing on any screen. The interface is furniture around a printed page.
- **Do** express every state as a mark plus color (`■ HELD`), so it survives all five stocks, low contrast, and colorblind readers.
- **Do** print chrome in and lift it off — a `120ms` ink impression on a boundary, never a slow fade. Announce a chrome change before it lands; nothing appears mid-page while the reader is reading.
- **Do** scale richness to the device. Detect capability (`deviceMemory`, `hardwareConcurrency`, `saveData`, `prefers-reduced-motion`) and ship three tiers: full micro-interactions on capable hardware, texture-substituted state changes in the middle, marks-only at the floor. Nothing about this is optional — a delight that costs the reader a frame during a page turn has become a defect.
- **Do** use `var(--...)` tokens for every color. The stock changes; your component must not care which one is loaded.
- **Do** set every label, badge, and control in Archivo Narrow uppercase at `0.08em`.
- **Do** lead every destination and every retention state with an icon, and give each one an `aria-label` and a tooltip.
- **Do** keep every cover portrait: 2:3 in grids, real file aspect on the detail page.
- **Do** decide what ultrawide width *becomes* — a docked panel, another column — and cap everything else.

### Don't:
- **Don't** use `backdrop-filter` or `box-shadow` anywhere. Both are removed from this system.
- **Don't** use `filter: blur()` at any large radius on a large, animated, or frequently repainted element. The `blur(90px)` aurora orbs are the specific pattern being deleted.
- **Don't** introduce `#ffffff` or a blue-black ground. No true white, and near-black-plus-neon is the generic this system exists to refuse.
- **Don't** render orange below full opacity, as a glow, or as a border tint. It is ink or it is absent.
- **Don't** round a plate or a cover. Square cuts, `2px` on small furniture, `6px` only on finger targets.
- **Don't** leave chrome on screen while the reader is reading. If it is visible and not needed, the cat never disappeared.
- **Don't** set anything in a serif, and don't add a third font family.
- **Don't** crop a manga cover to a banner, a hero strip, or any landscape box. It is portrait or it is absent.
- **Don't** ship an icon-only control for a destructive or irreversible action, and never without an accessible name.
- **Don't** let a layout stretch past 2400px. Unbounded growth is not a responsive strategy.
- **Don't** use a glyph character where an icon belongs — `▶` renders with emoji presentation and breaks the palette.
- **Don't** animate on an infinite loop. The one existing exception, the skeleton shimmer, already disables itself under `prefers-reduced-motion` and stays that way.
