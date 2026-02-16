

# Events Module Refactor -- Operations Architecture

## Overview

Refactor the Events module from a single flat page into a full module with its own layout, sidebar, and sub-pages -- matching the Operations pattern exactly.

The current `/events` page (Gantt + CRUD in one file) and `/mentoring` page will be reorganized into sub-routes under an `EventsLayout`.

---

## New Architecture

```text
/events              --> Timeline Dashboard (Gantt + Calendar toggle)
/events/planning     --> Event CRUD with logistics toggles + delegation engine
/events/mentoring    --> Mentoring matchmaker (moved from /mentoring)
```

---

## Files to Create

### 1. `src/components/EventsLayout.tsx`
- Identical pattern to `OperationsLayout`: auth guard, `GlobalTopBar`, `SidebarProvider` wrapping `EventsSidebar` + main content, `SidebarTrigger` bar.

### 2. `src/components/EventsSidebar.tsx`
- Three nav items using `NavLink`:
  - **Timeline** (`/events`) -- `CalendarDays` icon
  - **Planning** (`/events/planning`) -- `ClipboardList` icon
  - **Mentoring** (`/events/mentoring`) -- `Users` icon
- Module label "Events & Programs" at top, matching Operations sidebar style.

### 3. `src/pages/events/Timeline.tsx` -- Timeline Dashboard
- **Gantt View** (default): CSS Grid Gantt chart from current `Events.tsx`, refactored to show current month's days as columns.
- **Calendar View**: Toggle button switches to a 7-column monthly calendar grid showing events on their dates.
- **Toggle**: A button group (Gantt | Calendar) at the top of the card.
- **Event Click**: Clicking any event opens an **Event Card Dialog** with:
  - Event details (name, dates, status)
  - **Checklist section**: Add/toggle/delete checklist items, persisted to the `checklist` JSONB column in Supabase.
- Data: Live from `events` table via React Query.

### 4. `src/pages/events/Planning.tsx` -- Event CRUD + Delegation
- Moved from current `Events.tsx` (the table/dialog portion).
- Full event list with Add/Edit/Delete.
- **Logistics toggles** (Room, Transport, Catering) in the create/edit dialog.
- **Delegation Engine**: On save, sync tasks to `tasks` table with `source_module: 'Events'` (existing `syncTasks` logic).
- **Checklist** section in the edit dialog as well.

### 5. `src/pages/events/Mentoring.tsx`
- Move current `src/pages/Mentoring.tsx` content here (rename import path).

---

## Files to Update

### 6. `src/App.tsx`
- Remove old `/events` and `/mentoring` routes.
- Add new routes:
  - `/events` -- `EventsLayout` wrapping `Timeline`
  - `/events/planning` -- `EventsLayout` wrapping `Planning`
  - `/events/mentoring` -- `EventsLayout` wrapping `Mentoring`

### 7. `src/pages/Home.tsx`
- "Events" card route stays `/events` (no change needed).
- Remove "Mentoring" card since it's now a sub-page of Events, OR keep it linking to `/events/mentoring`.

---

## Checklist Feature (Event Card Dialog)

The `events` table already has a `checklist` JSONB column (default `'[]'`).

Each checklist item will be an object: `{ id: string, text: string, done: boolean }`.

**UI in the Event Card Dialog:**
- List of items with checkboxes and delete buttons.
- Input field + "Add" button to append items.
- On any change, update the event's `checklist` column via Supabase.

---

## Technical Details

**Gantt View (Current Month Focus):**
- Columns = days of the current month (28-31 columns).
- Each event row spans from `start_date` to `end_date` using CSS Grid `grid-column`.
- Status-based color coding (Planning=blue, Active=green, Completed=muted).
- Month navigation arrows to view other months.

**Calendar View:**
- 7-column grid (Sun-Sat), rows = weeks of the month.
- Events displayed as colored badges on their date cells.
- Clicking a date's event opens the Event Card.

**Delegation Engine (frontend only):**
- Existing `syncTasks` function: deletes old tasks for the event, inserts new ones based on toggled logistics.
- No Edge Functions or triggers.

**No new dependencies. No database migrations needed.** The `checklist` JSONB column already exists. All logic runs on the frontend.

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/EventsLayout.tsx` | Create | Auth-guarded layout with sidebar |
| `src/components/EventsSidebar.tsx` | Create | 3-item sidebar nav |
| `src/pages/events/Timeline.tsx` | Create | Gantt + Calendar toggle + Event Card with checklist |
| `src/pages/events/Planning.tsx` | Create | Event CRUD + logistics + delegation engine |
| `src/pages/events/Mentoring.tsx` | Create | Mentoring matchmaker (moved) |
| `src/App.tsx` | Update | Replace old routes with new module routes |
| `src/pages/Home.tsx` | Update | Adjust Mentoring card to link to `/events/mentoring` |

