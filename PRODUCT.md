# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — the reader.** A member of a closed, invite-only community reading manga on their own time, most often on a phone, often on a poor or absent connection. They are not browsing a storefront; they return to a library they already consider theirs and want to resume where they left off with no ceremony.

**Secondary — the operator.** A permission-gated staff audience working inside `/dashboard` (tags, monitoring, sensitive content). They are doing catalog upkeep, not reading. Their success is task throughput and legibility of system state, not immersion.

## Product Purpose

Gatuno is a self-hosted manga aggregator. It pulls titles in by web scraping and holds them in the reader's own instance, so that **when the upstream source goes down, is taken offline, or disappears, the library still works.** Access is invite-only: a known group of readers sharing one catalog.

Success is a reader opening a chapter they saved months ago, on a phone with no signal, and having it behave exactly as it did the day it was scraped.

## Positioning

Two claims a neighboring reader cannot truthfully make together:

1. **Survives the source.** Kavita and Komga serve files you already own; Tachiyomi reads sources live and dies with them. Gatuno scrapes *and* retains — the catalog outlives the site it came from.
2. **Offline-first, not offline-capable.** Downloaded chapters live in IndexedDB and read identically with no network. Offline is the design center, not a degraded fallback.

## Operating Context

- Reading happens on phones first, frequently on low-end hardware and unreliable networks; desktop is real but secondary.
- Installed as a PWA (`display: standalone`, service worker), so the app is often opened outside a browser chrome.
- Sessions are resumptive: readers come back to an in-progress chapter far more often than they start something new.
- Reading position and library state move across tabs and devices (`ReadingProgressSyncService`, WebSocket book status) — the reader should never be asked to think about sync.
- The operator's dashboard is a separate working context reached through explicit permissions (`internal:books:dashboard:view`, `internal:books:edit`, `internal:books:relationships:manage`), not a mode readers stumble into.

## Capabilities and Constraints

**Confirmed capabilities**
- Catalog acquisition by web scraping into a self-hosted instance; retained content remains readable after the source is gone.
- Offline download manager backed by IndexedDB; chapter reading, PDF viewing, and Markdown rendering.
- Cross-tab and cross-device reading-progress sync; real-time book/processing status over WebSocket (MQTT client present).
- Passwordless authentication via WebAuthn (`@simplewebauthn/browser`).
- Discovery surfaces: home with featured carousel, books listing with advanced filtering, personal library, latest reads, public user profiles, book reviews.
- Per-user settings: appearance, filters, readings, profile, security, notifications.
- Operator dashboard: home, tags, monitoring, sensitive content.

**Durable constraints**
- **Sensitive-content gating is required.** The catalog carries adult or sensitive material that must stay behind an explicit per-user setting and must never surface by default — including in featured, search, and recommendation surfaces.
- **The reader's device is the constraint.** Reading must stay smooth on low-end phones. Performance ceilings are product requirements, not taste: large-radius `filter: blur()` on large or animated elements, heavy function calls bound in templates, and un-throttled scroll/resize listeners are defects. `OnPush` + signals throughout; scroll/resize work runs outside the Angular zone.
- Angular 21, standalone components, signal-based APIs, built-in control flow, SSR with per-route render modes (prerender / server / client-only). Chapter reading and library are client-only by necessity (auth state, external image hosts).
- Five themes ship and are all first-class: `light` (the `:root` default), `dark`, `true-dark`, `dracula`, and `slate`. The theme is resolved before first paint from `@gatuno/theme` in localStorage, falling back to `prefers-color-scheme`. Personalization is a product requirement, not a convenience.

**Observed but not confirmed as a commitment**
- All shipped UI copy is Portuguese (pt-BR); `<html lang="pt-BR">`. The user did not mark this as a binding constraint, so localization remains an open product decision. Future copy should match the existing pt-BR surface unless the user decides otherwise.

## Brand Commitments

- Name: **Gatuno**. Manifest description: "Leia seus livros e mangás favoritos".
- Existing icon set and maskable PWA icons under `public/icons/`; brand color `#000212`.
- An incumbent visual language exists and is documented by the project itself: `AURORA_DESIGN.md` (Aurora Glassmorphism) and `styling-guidelines.md`. Color tokens live in `public/assets/scss/_color.scss` and `_color-definitions.scss`; all color must go through CSS variables so light/dark both hold.
- A component library already exists under `src/app/components/` and `src/app/features/` (inputs, select, context-menu, dropdown-menu, notification, icons, image-viewer, blurhash, readers, book-filter, item-book). Extend before creating.

## Evidence on Hand

- Real running application with a full route surface (home, books, book detail, chapters, library, latest-reads, public profiles, user settings, dashboard).
- Real backend contract: `swagger.json` / `api-docs.json`, GraphQL introspection schema, helper scripts (`npm run api:docs`, `npm run api:graphql`).
- Prior performance/usability reports under `docs/reports/` (chapters, readers, book grid, inputs, micro-interactions).
- **No** testimonials, user counts, press, benchmarks, pricing, or licensing exist. Future work must not fabricate them — the product is invite-only and self-hosted; there is no public audience to quote.

## Product Principles

1. **The library outlives its sources.** Anything that makes retained content feel provisional, remote, or dependent on a live upstream works against the reason this product exists.
2. **Resume beats discover.** The returning reader with an unfinished chapter is the default case; new-title discovery is the exception, not the front door.
3. **Offline is the design center.** No surface may assume a network. Absent, stale, or downloading states are primary states with real designs — not error toasts.
4. **The phone is the true target.** If it is not smooth on a low-end phone, it is not done.
5. **Sensitive content is opt-in, always and everywhere.** No surface reveals it, hints at it, or counts it before the reader has asked for it.
6. **Readers and operators are different products.** Reading is immersive; the dashboard is a tool. Do not make either one wear the other's clothes.

## Accessibility & Inclusion

No product-specific standard was established by the user. The codebase already invests in accessibility (`visually-hidden` headings, `aria-label`/`aria-roledescription` on the carousel, decorative images correctly marked, pause-on-hover/focus for auto-advancing content); treat that as the working floor and do not regress it.
