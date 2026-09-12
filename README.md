# Workspace — Lightweight Team Workspace (MVP)

A single-company work management workspace: tasks, calendar, notes, a collaborative
whiteboard, company/employee directory, announcements and an in-app notification
center — built as a **frontend-only demo/MVP**.

> **This is a demo/MVP, not a production application.** See [Security & data
> disclaimer](#security--data-disclaimer) before using it for anything beyond a demo.

## Product overview

Workspace is a "Notion + Trello + Slack-lite" style internal tool for one company,
aimed at showing a coherent, realistic B2B SaaS product experience end-to-end without
a backend. Every module reads and writes through a single client-side Store, so the
same Task/User/CalendarEvent/Announcement/Notification data is consistent across every
screen that touches it.

## Features

- **Demo Auth** — hash-routed login (`#/login`) with quick-login buttons for the three
  demo roles (Owner / Manager / Employee). Any non-empty email/password logs in.
- **Dashboard** (`#/dashboard`) — greeting, live clock, weather (geolocation +
  Open-Meteo), today's meetings, "my tasks", Kanban statistics, active company
  announcements.
- **Kanban** (`#/kanban`) — 5-column board (Backlog/To Do/In Progress/In Review/Done),
  search, filters (assignee/priority/tag/only mine), drag-and-drop + fallback move
  buttons, task drawer with deadline/reminder, priority, tags, comments, attachments.
- **Calendar** (`#/calendar`) — Month/Week/Day views, create/edit/delete events,
  participants, location, meeting URL, and task deadlines rendered alongside events.
- **Notes & Whiteboard** (`#/workspace`) — rich-text notes with autosave and sharing;
  an advanced whiteboard (select/hand/pen/highlighter/eraser/text/sticky/shapes
  (rectangle/ellipse/triangle)/line/arrow/connector, undo/redo, pan/zoom, sharing).
- **Company / Employees / Announcements** (`#/company`) — editable company profile,
  employee directory with search/filters/detail/add/edit/deactivate, announcements
  with create/edit/archive.
- **Notification Center** — a bell with an unread badge and a popover/panel covering
  task assignment, deadline-soon/overdue, event invitations and announcements, with
  read/unread state, mark-all-read, and click-through navigation to the source
  entity.
- **Reset demo data** — an Owner-only action (sidebar) to wipe and re-seed the demo
  state, behind a custom confirmation dialog.

## Tech stack

Vanilla JavaScript (ES modules), HTML, CSS. No framework, no build step, no backend.

- `localStorage` for persistence (see [Storage](#storage))
- Native browser APIs: Geolocation, Notification, Drag and Drop, Pointer Events
- No external runtime dependencies — only two Google Fonts are loaded over the network

## Project structure

```
index.html          App shell markup: login screen, sidebar/topbar, drawers container
style.css            Single stylesheet — the whole design system
CLAUDE.md            Project instructions/spec this codebase was built against
js/
  app.js             Entry point: wires Login/App Shell/Router/Sidebar, reset-data modal
  router.js          Minimal hash router
  store.js           Single source of truth over localStorage — all reads/writes go here
  migrations.js       schemaVersion + normalization of every entity, legacy-data migration
  demo-data.js        Demo company/users/tasks/events/notes/whiteboards/announcements
  auth.js            Demo-only login/quick-login/logout
  toast.js           Shared toast notifications (immediate feedback)
  dashboard.js       #/dashboard
  kanban.js          #/kanban + shared Task drawer (also opened from Dashboard/Notifications)
  calendar.js        #/calendar + shared Event drawer
  workspace.js        #/workspace — thin Notes/Whiteboards tab orchestrator
  notes.js           Notes list/editor/autosave/share
  whiteboard.js       Whiteboard list/canvas/tools/persistence
  sharing.js         Shared Share dialog + sharing-visibility helpers (Notes & Whiteboard)
  company.js         #/company — Company / Employees / Announcements tabs
  notifications.js   Notification Center (bell, panel, badge, navigation)
.claude/
  launch.json        Dev-only launch config for a local static server
  static-server.ps1  Dev-only helper script (PowerShell) — not required to run the app
```

## How to run locally

Any static file server works — the app is plain HTML/CSS/JS loaded as ES modules
(which most browsers refuse to run from a `file://` URL, so a server is required).

**Python** (if installed):

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

**VS Code**: install the "Live Server" extension and click "Go Live" from
`index.html`.

**Node** (if installed), e.g. via `npx`:

```bash
npx serve .
```

The repo also includes `.claude/static-server.ps1` + `.claude/launch.json` — a
PowerShell static server used by this project's own dev tooling. It is **not**
required to run the app and is only relevant if you're already using that tooling.

## Demo roles

Use the quick-login buttons on the login screen, or type any email/password:

| Role     | Email               | Notes                                              |
|----------|---------------------|-----------------------------------------------------|
| Owner    | `owner@demo.local`  | Full access: company/employees/announcements edit, reset demo data |
| Manager  | `manager@demo.local`| Can manage tasks/events; read-only on Company/Employees/Announcements |
| Employee | `employee@demo.local` | Read-only on Company/Employees/Announcements; own tasks/notes |

Two more demo employees exist (`dmitry@demo.local`, `elena@demo.local`) for a more
realistic directory — log in with any of these emails and any password.

## Storage

Everything lives in the browser's `localStorage`, under one key:

- `workspace-app-v2` — the entire application state (company, users, tasks, calendar
  events, notes, whiteboards, announcements, notifications), versioned with a
  `schemaVersion` and migrated/normalized on load (see `js/migrations.js`).
- `workspace-session-v1` — which demo user is currently "logged in".
- `kanban-tasks-v1` — read-only legacy key from an earlier prototype; migrated into
  `workspace-app-v2` on first load if present, never written to.

There is no server and no cross-device sync: data is private to one browser profile.
Clearing site data / using a different browser or a private window starts fresh.

## Reset demo data

Owner-only. Sidebar → the small reset icon next to "Log out" → confirm in the dialog
that appears (not a native browser `confirm()`). This rebuilds the entire state from
the demo seed (see `js/demo-data.js`) and reloads the page; the current session stays
logged in (demo user ids are stable). Use this to return to a clean, presentable state
before a demo.

## Known MVP limitations

- **Auth/permissions are UI-level only** — see the disclaimer below.
- No real-time collaboration: two browser tabs/users do not see each other's changes
  live; you need to refresh.
- No backend validation, rate limiting, or server-side authorization of any kind.
- Attachments are stored as base64 `dataURL`s directly in `localStorage`, capped at 5MB
  per file — this is a demo convenience, not a real file storage system, and is subject
  to the browser's overall `localStorage` quota (typically 5–10MB per origin).
- Whiteboard/Note images (avatars, board objects) are similarly inlined and
  size-limited (avatars/logo are downscaled client-side before being stored).
- No pagination — every list (tasks, notifications, notes, etc.) loads and renders in
  full; fine at demo scale, not designed for thousands of records.
- No org chart, payroll, timesheets, vacation management, SSO, or real HR workflows —
  intentionally out of scope for this MVP.
- Notification delivery is in-app only (plus the optional native Browser Notification
  API); there is no email/SMS/push/webhook delivery.

## Technical debt / things to know before extending

- `store.js` is a single flat module covering every entity — fine at this scale, would
  be split per-entity in a larger codebase.
- Whiteboard content objects (sticky/text) render as DOM elements while shapes render
  as SVG in the same layer; DOM content always paints above SVG shapes (no true
  z-index interleaving by creation order).
- Undo/redo on the whiteboard is snapshot-based (whole-array snapshots), not an
  operation/diff log — simple and correct at this scale, not efficient for very large
  boards.
- A few list/detail views (e.g. Kanban's assignee filter) intentionally do not
  exclude deactivated users, since they're filtering *existing* historical data, not
  offering a *new* assignment — see `CLAUDE.md`/stage notes if this distinction isn't
  obvious from context when you next touch that code.

## Future backend migration notes

If/when this moves to a real backend, the seams are already drawn along `store.js`'s
public function boundary — every UI module calls `store.getX()` / `store.createX()` /
`store.updateX()` and never touches `localStorage` directly. Migrating means:

1. Replace `store.js`'s internals with `fetch()` calls to a real API, keeping the same
   exported function signatures where practical (most already return `{ ok, entity }`,
   which maps naturally to an async API response).
2. Move `migrations.js`'s normalization logic server-side (schema migrations on the
   database instead of on load).
3. Replace `auth.js`'s demo login with real authentication (sessions/JWT), and move
   role-based permission checks from "hide the button" (current UI-level approach) to
   real server-side authorization — **every current permission check must be
   re-implemented server-side**, none of them are safe to rely on as-is.
4. Replace the Notification Center's client-side `createNotification` calls with
   server-triggered notifications (e.g. on the same task/event/announcement write
   path), and consider WebSocket/SSE for live delivery instead of the current
   "next page load" model.
5. Move attachments/avatars from inline `dataURL`s to real object storage with proper
   upload endpoints.

## Responsive / accessibility

Desktop-first, verified usable down to ~390px wide (see stage notes): sidebar becomes
an off-canvas drawer, Kanban scrolls horizontally by column, the notification panel
becomes full-screen, Company/Employees sections stack to one column, and drawers
become full-width. Icon-only buttons carry `aria-label`s, navigation exposes
`aria-current`, overlays close on <kbd>Escape</kbd>, and focus states are visible on
interactive text controls.

## GitHub Pages readiness

The app uses hash-based routing (`#/dashboard`, `#/kanban`, ...), relative asset paths,
and native ES modules (`<script type="module">`) — no absolute filesystem paths, no
build step, no server-side routing requirement. This makes it compatible with static
hosts like GitHub Pages as-is. **This repository has not been published to GitHub
Pages or any other host as part of this work** — only prepared for it; publishing is a
separate, deliberate step for you to take (push to a repo, enable Pages on the
`main` branch or `/docs`, and set `index.html` as the entry point).

## Security & data disclaimer

- **Demo authentication and role-based permissions are frontend-only UI conveniences.**
  Any user can bypass them by editing client-side state (e.g. via devtools). This is
  explicitly *not* production security and must not be treated as one.
- All data is stored in the browser's `localStorage` on the device running it. It is
  demo persistence, not a secure or durable data store — do not put real personal,
  financial, or confidential data into this app.
- Do not deploy this as-is for any workflow that requires real access control, audit
  logging, or data protection guarantees.
