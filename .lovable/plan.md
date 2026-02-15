

# Phase 3: Tasks, Contracts, Global CRUD + AI Integration

## Overview

Build the full Task Kanban, Contract Tracker, add Edit/Delete actions to all tables, and wire up AI features -- with the delegation workaround of appending "Assigned to: [Name]" to the task description instead of using the `assigned_to` UUID field.

No database migrations needed -- all existing columns support these features.

---

## 1. Reusable CRUD Component

### `src/components/ConfirmDeleteDialog.tsx`
- Reusable AlertDialog accepting `open`, `onConfirm`, `onCancel`, `title`, `description` props
- "Are you sure?" confirmation with Cancel/Delete buttons
- Used by Stipends, Tasks, and Contracts pages

---

## 2. Stipends -- Add Edit/Delete Actions

### Update `src/pages/operations/Stipends.tsx`
- Add an Actions dropdown menu (using DropdownMenu) with Edit and Delete options per row
- **Edit**: Opens the existing dialog pre-filled with the stipend's current `founder_name`, `base_amount`, and `deductions`; submits via `supabase.from("stipends").update({...}).eq("id", id)`
- **Delete**: Opens `ConfirmDeleteDialog`; on confirm calls `supabase.from("stipends").delete().eq("id", id)`
- Keep existing "Pay" button in the actions area

---

## 3. Task Manager (`/operations/tasks`)

### Full rewrite of `src/pages/operations/Tasks.tsx`

**Kanban Board:**
- Three columns: "To Do", "In Progress", "Done"
- Each task rendered as a card with title, priority badge, due date
- Move buttons (left/right arrows) on each card to shift status between columns via `supabase.from("tasks").update({ status }).eq("id", id)`

**New Task Dialog:**
- Fields: Title, Description (textarea), Priority (Select: Low/Medium/High), Due Date (date input)
- "AI Checklist" button: calls `generateChecklist(description)` from `src/utils/gemini.ts`, appends the Markdown result below the description with loading state
- Inserts via `supabase.from("tasks").insert({...})`

**Edit Task Dialog:**
- Same fields as New Task, pre-filled with current data
- Updates via `supabase.from("tasks").update({...}).eq("id", id)`

**Delete Task:**
- ConfirmDeleteDialog before `supabase.from("tasks").delete().eq("id", id)`

**Bulk Delegation (workaround -- no profiles table):**
- Checkbox on each task card for selection
- When 1+ tasks selected, a "Delegate" button appears in the header
- Clicking opens a Popover with a text input for the team member's name
- On confirm, for each selected task: appends `"\n\nAssigned to: [Name]"` to the task's `description` field via `supabase.from("tasks").update({ description: existingDesc + "\n\nAssigned to: Name" }).eq("id", id)`
- This avoids writing to the `assigned_to` UUID column

**Customizable Column Names:**
- Gear icon opens a settings dialog to rename display labels (e.g., "To Do" -> "Backlog")
- Stored in `localStorage` key `forge_task_columns`
- The actual `status` values in Supabase remain unchanged

**Task Labels:**
- Settings dialog to add/remove custom labels (e.g., "Urgent", "Paperwork")
- Stored in `localStorage` key `forge_task_labels`
- Displayed as small colored badges on task cards (matched by checking if the label text appears in the task description)

### `src/components/TaskCard.tsx`
- Reusable card component for the Kanban board
- Displays title, priority badge, due date, labels, delegation info
- Checkbox for bulk selection
- Left/right arrow buttons to move between columns

---

## 4. Contract Tracker (`/operations/contracts`)

### Full rewrite of `src/pages/operations/Contracts.tsx`

**Contract Table:**
- Columns: Title, Stakeholder, Value (MAD), Status (visual pipeline), Start Date, End Date, Actions
- Actions dropdown: Edit, Delete, Draft Email

**Visual Status Pipeline:**
- New component `src/components/StatusPipeline.tsx`
- Horizontal stepper showing stages as connected circles/steps
- Props: `stages: string[]`, `currentStage: string`, `onStageClick: (stage) => void`
- Active stage highlighted, completed stages filled, future stages outlined
- Clicking a stage updates the contract status via `supabase.from("contracts").update({ status }).eq("id", id)`

**Add Contract Dialog:**
- Fields: Title, Stakeholder Name, Value, Type (Select), Start Date, End Date
- Status defaults to first stage

**Edit Contract Dialog:**
- Pre-filled with current data, all fields editable
- Updates via `supabase.from("contracts").update({...}).eq("id", id)`

**Delete Contract:**
- ConfirmDeleteDialog before `supabase.from("contracts").delete().eq("id", id)`

**Custom Stages:**
- Gear icon on page header opens settings dialog
- Users can rename, add, or remove stages
- Stored in `localStorage` key `forge_contract_stages`
- Default: ["Drafting", "Sent", "Signed"]

**AI Email Drafter:**
- "Draft Email" button in the actions dropdown for each contract
- Calls `draftFollowUpEmail(title, stakeholder, status)` from `src/utils/gemini.ts`
- Shows generated email in a Dialog with "Copy to Clipboard" button
- Loading spinner while generating

---

## 5. Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/ConfirmDeleteDialog.tsx` | Create | Reusable delete confirmation dialog |
| `src/components/StatusPipeline.tsx` | Create | Visual stage stepper for contracts |
| `src/components/TaskCard.tsx` | Create | Kanban task card with selection and move |
| `src/pages/operations/Tasks.tsx` | Rewrite | Full Kanban with CRUD, delegation, AI checklist |
| `src/pages/operations/Contracts.tsx` | Rewrite | Full table with pipeline, CRUD, AI email |
| `src/pages/operations/Stipends.tsx` | Update | Add Edit/Delete actions column |

---

## Technical Details

**CRUD Operations:**
- Edit: `supabase.from("table").update({fields}).eq("id", id)`
- Delete: `supabase.from("table").delete().eq("id", id)`
- All wrapped in React Query `useMutation` with `invalidateQueries` on success
- Toast notifications via sonner for success/error

**Delegation Workaround:**
- Does NOT write to `assigned_to` (UUID column)
- Instead appends "Assigned to: [Name]" to the `description` text field
- Future phase will introduce a proper profiles/team table

**Settings Storage:**
- `localStorage` keys: `forge_task_columns`, `forge_task_labels`, `forge_contract_stages`
- Portable for Vercel migration, no extra DB tables needed

**AI Integration:**
- Uses existing `src/utils/gemini.ts` functions directly (client-side)
- `generateChecklist()` for task creation dialog
- `draftFollowUpEmail()` for contract email drafting
- Loading states and error handling with toast

**No Database Migrations Required.**

