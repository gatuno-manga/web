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

### 6. AI & Tooling
- **API Documentation:** Use the local helper scripts to fetch and read the API documentation (Swagger/REST or GraphQL).
  - **Swagger / REST:**
    - `npm run api:docs -- --fetch [url]` to update the local `swagger.json`.
    - `npm run api:docs -- --summary` to see all available endpoints.
    - `npm run api:docs -- --path /api/v1/resource` to see details of a specific endpoint.
    - `npm run api:docs -- --model ResourceName` to see the schema for a specific model.
  - **GraphQL:**
    - `npm run api:graphql -- --fetch [url]` to update the local `graphql.json`.
    - `npm run api:graphql -- --summary` to ver todas as queries e mutations disponíveis.
    - `npm run api:graphql -- --operation OperationName` to ver os detalhes de uma query ou mutation.
    - `npm run api:graphql -- --type TypeName` to ver o schema de um tipo GraphQL específico.

### 7. Core AI Execution Rules (12-Rule Template)

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

#### Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

#### Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

#### Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

#### Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

#### Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

#### Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

#### Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

#### Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

#### Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

#### Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

#### Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

#### Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.
