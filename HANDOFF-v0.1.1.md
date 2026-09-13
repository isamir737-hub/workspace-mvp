# Handoff — v0.1.1 (2026-09-13)

Written at the end of the v0.1.1 UI-polish session for the next Claude session to
pick up the project safely. Read this together with [`CLAUDE.md`](CLAUDE.md) and
[`README.md`](README.md), which remain the authoritative spec/reference — this file
only adds session-to-session continuity.

## 1. Current project state

- **Last stable version:** `v0.1.1` — tag `v0.1.1` points to commit `6210165`
  ("Polish UI for v0.1.1"). Tag `v0.1` points to `475980e` ("Release v0.1 demo").
- **Current branch:** `main`.
- **Working tree:** clean as of this handoff (`nothing to commit, working tree clean`,
  `up to date with 'origin/main'`). The working tree **should always be clean** before
  starting new work — if it isn't, `git status`/`git diff` first and figure out why
  before touching anything.
- Both `v0.1` and `v0.1.1` are annotated as real git tags, not just commit messages —
  use `git tag --list` / `git log --oneline -10` to reorient quickly.

## 2. Current architecture

- **Stack:** Vanilla JavaScript (ES modules), HTML, CSS. No framework, no build step,
  no backend. Runs from any static file server (see README "How to run locally").
- **Routing:** minimal hash router (`js/router.js`) — `#/login #/dashboard #/kanban
  #/calendar #/workspace #/company`. Chosen for `file://`/GitHub Pages compatibility.
- **Store / localStorage boundary:** `js/store.js` is the *only* module allowed to
  touch `localStorage`. Every UI module reads/writes through `store.getX()` /
  `createX()` / `updateX()` / `deleteX()`. `create*`/`update*` return `{ ok, entity }`.
  Two localStorage keys: `workspace-app-v2` (whole app state, versioned via
  `schemaVersion`, currently `SCHEMA_VERSION = 2` in `js/migrations.js`) and
  `workspace-session-v1` (which demo user is logged in). A third, read-only legacy key
  `kanban-tasks-v1` is migrated in on first load if present and never written to again.
- **Modules:** `app.js` (entry point, wires login/shell/router/sidebar/reset-modal),
  `router.js`, `store.js`, `migrations.js` (schemaVersion + per-entity normalization +
  legacy migration), `demo-data.js` (seed data), `auth.js` (demo login/logout),
  `toast.js` (shared toast system), `dashboard.js`, `kanban.js` (+ shared Task drawer),
  `calendar.js` (+ shared Event drawer), `workspace.js` (thin Notes/Whiteboard tab
  orchestrator), `notes.js`, `whiteboard.js`, `sharing.js` (shared Share dialog),
  `company.js` (Company/Employees/Announcements tabs), `notifications.js`.
- **Auth/roles:** demo-only, frontend UI-level, **not real security** (see
  README "Security & data disclaimer"). Roles: `owner`, `manager`, `employee`. Any
  non-empty email/password logs in; quick-login buttons exist for all three roles.
  Role checks are scattered as `currentUser.role === '...'` (e.g. `company.js`,
  `kanban.js`) — every one of these must be re-implemented server-side if/when a real
  backend is added; none are safe to rely on as-is.
- **Notifications:** `notifications.js` (bell + unread badge + popover/panel) backed by
  `store.createNotification`/`markNotificationRead`/`markAllNotificationsRead`. Types:
  `task_assigned`, `task_deadline_soon`, `task_overdue`, `event_invitation`,
  `announcement`. Dedup via `dedupeKey` — the single point where periodic checkers
  (deadline polling) avoid re-firing the same notification. In-app only (plus optional
  native Browser Notification API) — no email/SMS/push/webhook delivery.
- **Notes/Whiteboards:** `notes.js` (rich-text, autosave, sharing) and `whiteboard.js`
  (select/hand/pen/highlighter/eraser/text/sticky/shapes/line/arrow/connector,
  undo/redo, pan/zoom, sharing), orchestrated by the thin `workspace.js` tab switcher,
  sharing UI/visibility shared via `sharing.js`. Whiteboard undo/redo is whole-array
  snapshot based (not an op/diff log). Sticky/text render as DOM, shapes as SVG in the
  same layer — DOM always paints above SVG (no true z-index interleaving).
- **Company/Employees:** `company.js` — editable company profile (Owner-only edit),
  employee directory (search/filter/detail/add/edit), announcements
  (create/edit/archive). Deactivating an employee sets `active: false` via
  `store.updateUser` — **users are never physically deleted**.
- **Calendar:** `calendar.js` — Month/Week/Day views, create/edit/delete events,
  participants/location/meetingUrl, task deadlines rendered alongside events, shared
  Event drawer.
- **Kanban:** `kanban.js` — 5-column board (Backlog/To Do/In Progress/In Review/Done),
  search, filters (assignee/priority/tag/only-mine), drag-and-drop + fallback move
  buttons, shared Task drawer (deadline/reminder/priority/tags/comments/attachments).
  Assignee filter intentionally does **not** exclude deactivated users (filtering
  existing historical data, not offering a new assignment — see README "Technical
  debt").

## 3. Critical project rules (do not violate silently)

- No framework (React/Vue/Angular/etc.), no UI libraries beyond what's already used.
- No backend yet — this stays a frontend-only MVP until a deliberate, explicit
  decision to add one.
- No build step — the app must keep running as plain ES modules from a static server.
- `store.js` stays the single boundary to all persisted data — never let a UI module
  touch `localStorage` directly.
- Preserve existing entity IDs and legacy-data compatibility — `kanban-tasks-v1`
  migration path must keep working; `schemaVersion` bumps must migrate forward, never
  silently drop old fields.
- Never physically delete employees — deactivate only (`active: false`).
- Preserve current role logic (owner/manager/employee) exactly as implemented, unless
  a task explicitly asks to change permissions.
- Preserve demo-data seed behavior and the "Reset demo data" flow (Owner-only, rebuilds
  state from `demo-data.js`, keeps the current session logged in since demo user ids
  are stable).

## 4. Current design system

- **Font:** Inter (Google Fonts), fallback stack
  `"Inter", "Roboto", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
  sans-serif` via the `--font-sans` token. Weights used: mainly 400/500/600/700, with
  800 kept only where it was already used for page-title-level headings. Verified
  clean for English/Français (incl. accents)/Русский, plus numbers/dates/time/percent.
- **Accent palette:** existing red accent, unchanged base palette. New tokens are all
  derived shades: `--accent-soft`, `--accent-hover`, `--accent-border`,
  `--accent-glow`, `--surface-hover`, `--surface-active`, `--border-strong`,
  `--text-muted-strong`. No new hues introduced.
- **States:** unified hover/active/focus-visible/disabled across
  `.btn-primary/secondary/danger`, `.icon-btn`, form inputs. Active/selected elements
  (sidebar nav, workspace tabs, Kanban filters/notification bell via `aria-expanded`,
  Calendar view-switcher) use the accent-soft + accent-border + accent text/icon
  pattern. Focus-visible gets a visible outline (+ soft glow on form fields);
  `prefers-reduced-motion: reduce` disables all transitions/animations globally.
- **Responsive Kanban behavior (as of this session):**
  - **≥1280px:** 5 columns in a CSS grid (`repeat(5, minmax(0,1fr))`), all visible,
    no scroll needed.
  - **901px–1279px:** board switches to `display:flex; overflow-x:auto`, each column
    fixed at `280px` — avoids column/title squeezing that grid caused in this range.
    Scroll is scoped to `.board`, never the whole page.
  - **≤900px:** unchanged pre-existing mobile behavior — flex row, each column
    `84vw`, swipe-style horizontal scroll, hidden scrollbar.
- **Breakpoints verified this session:** 1440 / 1280 / 1024 / 768 / 390 — see git log
  message on commit `6210165` and prior session output for full QA notes (sidebar
  drawer, buttons, pills, typography, notification panel, Calendar, Company).

## 5. Known limitations / technical debt

- Auth/permissions are frontend-only UI conveniences — bypassable via devtools, not
  real security. Every permission check needs a server-side re-implementation before
  any real backend ships.
- All persistence is `localStorage` — no server, no cross-device sync, no real-time
  collaboration between tabs/users (refresh required to see others' changes).
- Attachments/avatars/logo are inlined as base64 `dataURL`s, capped ~5MB/file, subject
  to the browser's overall `localStorage` quota (~5–10MB/origin typically).
- `store.js` is one flat module covering every entity — fine at this scale, would be
  split per-entity in a larger codebase.
- Whiteboard undo/redo is snapshot-based, not an operation/diff log — not efficient
  for very large boards.
- No pagination anywhere — fine at demo scale only.
- Kanban's 5-column layout at 901–1279px now scrolls horizontally by design (this
  session's fix) rather than being redesigned into a responsive multi-row layout —
  acceptable for a polish release, worth revisiting if v0.2 changes the Kanban layout
  itself.

## 6. What must not change without explicit sign-off

- The Store/localStorage data model, entity shapes, and `schemaVersion`/migration
  logic.
- Routing scheme (hash routes) and overall page/module structure.
- Role/permission logic (who can see/edit what).
- Kanban/Calendar/Notes/Whiteboard/Company/Notifications *functional* behavior —
  this has been explicitly protected across two consecutive polish sessions
  (v0.1.1 base pass + the Kanban-breakpoint follow-up) and should stay that way until
  a task explicitly scopes a functional/architecture change (i.e. v0.2 planning).
- Demo-data seed contents/shape and the Reset-demo-data flow.
- The "no framework / no build step / no backend yet" constraints in `CLAUDE.md`.

## 7. Suggested starting point for v0.2 planning

Before writing any code, read `README.md`'s "Future backend migration notes" and
"Technical debt" sections — they already lay out the seams (`store.js`'s function
boundary, `auth.js`'s replaceable login, notification creation path, attachment
storage) that a real v0.2 (backend, multi-company, or real-time) would need to cut
along. A good first v0.2 planning session would:
1. Decide the actual v0.2 scope (backend? multi-company? real-time? not yet?) rather
   than assuming — nothing in the current codebase commits to a direction beyond
   "the seams are drawn."
2. Re-read `CLAUDE.md`'s "ЦЕЛЬ ПРОДУКТА" (architectural runway toward on-premise/SaaS/
   multi-company/backend) to confirm it still matches current intent.
3. If backend work starts, do it behind `store.js`'s existing function signatures
   first (swap internals to `fetch()`), rather than rewriting call sites across every
   UI module.

## 8. Files the next session should read first

1. [`CLAUDE.md`](CLAUDE.md) — project spec/instructions this codebase was built against.
2. [`README.md`](README.md) — product overview, architecture, storage, known
   limitations, future-migration notes (most up to date, longer-form reference).
3. [`HANDOFF-v0.1.1.md`](HANDOFF-v0.1.1.md) — this file, for session continuity.
4. [`index.html`](index.html) — app shell markup.
5. [`style.css`](style.css) — the entire design system (tokens, components, responsive
   rules).
6. [`js/store.js`](js/store.js) — the data-access boundary; read this before touching
   any entity.
7. [`js/app.js`](js/app.js) — entry point / wiring.
8. [`js/router.js`](js/router.js) — routing.
9. [`js/demo-data.js`](js/demo-data.js) — seed data shape for every entity.
10. [`js/migrations.js`](js/migrations.js) — schemaVersion, normalization, legacy
    migration logic.
11. Then whichever feature module(s) the next task actually touches
    (`kanban.js`, `calendar.js`, `notes.js`, `whiteboard.js`, `company.js`,
    `notifications.js`, `sharing.js`, `dashboard.js`, `auth.js`, `toast.js`).
