

# Interconnected Modules: Source, Events, Mentoring, and Settings

## Overview

This plan adds 4 new pages and refactors existing ones to create an interconnected system where Events auto-generate Tasks for Operations. All changes use existing database tables -- only RLS policies need to be added for `events` and `mentoring_sessions`.

---

## Database Migration (RLS Policies Only)

The `events` and `mentoring_sessions` tables already exist but have **no RLS policies**. A migration will add authenticated-user access policies matching the pattern used by other tables.

---

## 1. Budget Source Page (`/operations/source`)

A new page under the Operations module to set and manage the Master Budget.

**What it does:**
- Table listing all budget categories from the `budgets` table
- Add/Edit/Delete budget categories with amounts
- Summary row showing Total Master Budget
- Links to the Dashboard which already reads from `budgets`

**Sidebar update:** Add "Budget Source" link to the Operations sidebar between Dashboard and Stipends.

---

## 2. Stipends Simplification

Simplify the existing Stipends page:
- Remove Deductions and Final Payout columns
- Keep only: Founder Name, Amount (base_amount), Date (created_at), Status, Actions
- The form only has Founder Name and Amount fields
- Remove deduction math entirely

---

## 3. Bulk Actions Bar (Selection Logic)

Add row-level checkboxes to Stipends and Contracts tables (Tasks already has this via TaskCard):
- A checkbox column on the left of each table row
- A "Select All" checkbox in the header
- When 1+ rows selected, a floating bar appears with: Edit (first selected), Delegate (where applicable), Delete (bulk)
- Reuse the same selection pattern across modules

---

## 4. Budget Sync on Dashboard

Update the Operations Dashboard to split expenses by status:
- **Total Spent** = sum of expenses where `status = 'Confirmed'` or `'Paid'`
- **Forecasted Spent** = sum of expenses where `status = 'Pending'` or `'Planned'`
- Add a 4th StatCard: "Forecasted Spent"
- Remaining = Total Budget - Total Spent (confirmed only)

---

## 5. Events Module (`/events`)

A new top-level module accessible from the Home page app launcher.

**Gantt Chart View:**
- Pure CSS grid-based timeline (no external library needed -- saves credits)
- Rows = events, columns = date range
- Each event bar spans from `start_date` to `end_date`
- Color-coded by status (Planning = blue, Active = green, Completed = gray)

**Event Creation/Edit Dialog:**
- Fields: Name, Start Date, End Date, Status
- Logistics toggles: Room, Transport, Catering (stored in the `needs` jsonb column as `["Room", "Transport", "Catering"]`)

**Delegation Engine:**
- When an event is saved with logistics needs, automatically INSERT tasks into the `tasks` table
- Each need becomes a task: title = "Arrange [Need] for [Event Name]", `source_module = 'Events'`, `source_id = event.id`
- On event update, remove old auto-generated tasks and re-create based on new needs

**Routing:** `/events` with its own layout or using the main Layout.

---

## 6. Mentoring Module (`/mentoring`)

A new top-level module accessible from the Home page (replaces "Founders" placeholder or adds alongside).

**Simple Table View:**
- Columns: Mentor Name, Founder Name, Session Date, Time Slot, Actions
- Add/Edit/Delete sessions
- Uses the existing `mentoring_sessions` table

---

## 7. Settings Page (`/settings`)

Rebuild the placeholder Settings page with actual functionality:
- **Global Labels Manager:** Add/remove labels stored in `localStorage` key `forge_global_labels`
- Default labels: "Urgent", "Operations", "Event", "Mentoring"
- These labels are shared across Task and Contract settings
- Clean card-based UI with label chips

---

## 8. Home Page Updates

Update the app launcher cards:
- "Events" card: now active, navigates to `/events`
- "Mentoring" card (replaces "Founders"): now active, navigates to `/mentoring`
- "Strategy" remains Coming Soon

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| Migration SQL | Create | Add RLS policies to `events` and `mentoring_sessions` |
| `src/pages/operations/Source.tsx` | Create | Master Budget manager |
| `src/pages/Events.tsx` | Create | Gantt chart + event CRUD + delegation engine |
| `src/pages/Mentoring.tsx` | Create | Mentor-Founder matchmaker table |
| `src/pages/Settings.tsx` | Rewrite | Global labels manager |
| `src/pages/operations/Stipends.tsx` | Update | Simplify columns, remove deduction math |
| `src/pages/operations/Dashboard.tsx` | Update | Add Forecasted Spent card, split expenses by status |
| `src/pages/operations/Contracts.tsx` | Update | Add checkbox selection + bulk actions bar |
| `src/pages/Home.tsx` | Update | Activate Events and Mentoring cards |
| `src/components/OperationsSidebar.tsx` | Update | Add Budget Source link |
| `src/App.tsx` | Update | Add routes for `/events`, `/mentoring`, `/operations/source` |

---

## Technical Details

**Delegation Engine Logic (Events -> Tasks):**
```text
On event save with needs ["Room", "Catering"]:
1. DELETE FROM tasks WHERE source_module = 'Events' AND source_id = event.id
2. INSERT INTO tasks (title, source_module, source_id, status) VALUES
   ('Arrange Room for [Event]', 'Events', event.id, 'To Do'),
   ('Arrange Catering for [Event]', 'Events', event.id, 'To Do')
```

**Gantt Chart:** CSS Grid approach -- no new dependencies. Each event row contains a bar positioned via `grid-column` based on date offset from the earliest visible date.

**Budget Sync:** The dashboard already fetches all expenses. The update simply filters by `status` field to separate confirmed vs. forecasted spending.

**Bulk Actions Pattern:** A reusable selection state (`useState<Set<string>>`) with a conditional bar that appears when `selected.size > 0`. Applied to Stipends and Contracts tables (Tasks already has it).

**No new npm packages required.**
