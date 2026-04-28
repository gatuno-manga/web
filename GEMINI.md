# Gatuno Frontend Development Log

## Core Architecture & Features

- **Framework:** Angular 21 based web application.
- **Real-time Updates:** WebSocket integration via `book-websocket.service.ts` for live status on book processing and updates.
- **State Synchronization:** Implemented a complex `ReadingProgressSyncService` for cross-device and cross-tab state management.
- **Offline Capabilities:** 
  - Integrated a **Download Manager** service using `idb` (IndexedDB) to manage content for offline reading.
  - Service Worker support for improved performance and reliability.
- **Authentication:** Passwordless authentication implemented via `@simplewebauthn/browser` (WebAuthn).
- **Media & Content:** 
  - Support for PDF viewing (`ng2-pdf-viewer`) and Markdown rendering (`ngx-markdown`).
  - Data visualization using `echarts`.
- **User Interface:**
  - Responsive **Dashboard** for an overview of user activities and book updates.
  - Detailed **Public Profiles** and customizable user settings.
  - Advanced book filtering and exploration tools.

## Infrastructure & Performance

- **Environment Management:** Automated environment variable generation via `generate-env.ts`.
- **Branding:** Custom icon generation script (`generate-icons.sh`) from SVG assets.
- **Quality & Maintenance:**
  - Robust testing setup with Karma and Jasmine.
  - Modular project structure for better feature encapsulation.
- **Deployment:** Multi-stage Docker builds optimized for production.

## Development Guidelines & Rules

This section contains mandatory rules for any AI agent or developer working on this project.

### 1. Component Reusability (CRITICAL)
**Rule:** Always verify if a component already exists in `src/app/components/` before proposing or creating a new UI element.
- **Key UI Primitives:** Check `inputs`, `select`, `context-menu`, `dropdown-menu`, `notification`, and `icons`.
- **Complex UI:** Check `image-viewer`, `blurhash`, `readers`, `book-filter`, and `item-book`.
- **Strategy:** If a component exists but lacks a specific feature, extend its functionality (e.g., via new inputs/outputs) instead of creating a duplicate.

### 2. Global Styling and Theming (CRITICAL)
**Rule:** Check global SCSS files before adding new styles to avoid duplication and theme inconsistencies.
- **Locations:** `public/assets/scss/` (`global.scss`, `_color.scss`, `_color-definitions.scss`, `_mixins.scss`).
- **Theming:** Use CSS variables (e.g., `var(--primary-color)`, `var(--app-background-color)`) for all colors to ensure proper light/dark mode support.
- **Animations & Layout:** Use existing mixins and classes for common patterns, such as:
  - `.placeholder`: For generic skeleton loading gradients.
  - `.skeleton-text`: For text placeholder lines.

### 3. Modern Angular (v21+) Standards
- **Standalone Components:** All components, directives, and pipes must be standalone.
- **Reactivity:** Prioritize **Signals** for state management. Use `computed()` for derived values.
- **Signals API:** Use `input()`, `output()`, and `model()` functions instead of the older `@Input()`, `@Output()` decorators.
- **Control Flow:** Use the built-in control flow syntax (`@if`, `@for`, `@switch`) in templates.
- **Change Detection:** Always use `changeDetection: ChangeDetectionStrategy.OnPush`.
- **Dependency Injection:** Use the `inject()` function for dependency injection instead of the constructor.

### 4. State & Backend Integration
- **State Sync:** Use `ReadingProgressSyncService` for maintaining reading state across tabs.
- **WebSockets:** Use existing WebSocket services for real-time notifications or book status updates.
- **Offline State:** All offline-related logic should be handled through the Download Manager and services interacting with IndexedDB.

### 5. Workflow & Verification (MANDATORY)
**Rule:** Every implementation must follow a rigorous verification and quality process.
- **Build & Test:** Always run `npm run build` and relevant tests (`npm run test:headless`) at the end of every implementation turn to ensure no regressions and that the project is deployable.
- **Testing Coverage:** You MUST create new unit tests for every new feature implemented or bug fixed. A task is not considered finished until its logic is verified by automated tests.
- **Clean Code:** Apply Clean Code principles rigorously. Focus on meaningful names, small functions, single responsibility, and removal of dead code or commented-out blocks.
- **Validation:** Finality is only achieved when the behavioral correctness and structural integrity are confirmed within the full project context.
