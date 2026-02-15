

# THE FORGE HUB - Operations & PMO Dashboard (Updated Plan)

## Overview

Build a full Operations dashboard with Financial Core, Task/Contract Tracker, and client-side AI integrations using the Google Generative AI SDK, all connected to the existing Supabase database.

---

## Phase 1: Foundation

### 1.1 Environment Setup
- Add `VITE_GEMINI_API_KEY=AIzaSyCje9YpInAkUKXB7M2-CsC2wO7n58wUvmk` to `.env`

### 1.2 Authentication (Login/Signup)
- Create `src/pages/Auth.tsx` with email/password login and signup forms
- Create `src/hooks/useAuth.ts` for session management
- Protect all routes, redirect unauthenticated users to `/auth`
- Add logout button in the sidebar

### 1.3 Database Migration - Stipends Table
Create a new `stipends` table via Supabase SQL:

```text
stipends
---------
id             uuid (PK, default uuid_generate_v4())
founder_name   text NOT NULL
base_amount    numeric NOT NULL
deductions     numeric DEFAULT 0
final_payout   numeric GENERATED ALWAYS AS (base_amount - deductions) STORED
status         text DEFAULT 'Pending'
created_at     timestamptz DEFAULT now()
```

RLS policy: authenticated users get full access (matching existing tables).

### 1.4 Updated Sidebar Navigation
Routes: Home, Dashboard, Finance (with sub-items), Tasks, Contracts, Settings

---

## Phase 2: Financial Core

### 2.1 Budget & Expenses Dashboard (`/dashboard`)
- Three stat cards: Total Budget, Total Spent, Remaining
- Currency toggle component (MAD default, USD, EUR) with conversion rates
- Warning badge when remaining budget is zero or negative
- Recharts bar chart: budget vs expenses by category
- All data from `budgets` and `expenses` tables

### 2.2 Stipend Manager (`/finance/stipends`)
- Table: Founder Name, Base Amount, Deductions (editable), Final Payout, Status
- "Add Stipend" dialog
- "Process Payment" button per row (sets status to "Paid")
- Final Payout = Base Amount - Deductions (computed in DB)

### 2.3 Finance Page (`/finance`)
- Tabs: Budget Overview | Stipend Manager

---

## Phase 3: Task & Contract Tracker

### 3.1 Task Kanban (`/tasks`)
- Three columns: To Do, In Progress, Done
- Task cards with title, priority badge, due date
- "New Task" dialog: Title, Description, Priority, Due Date
- Bulk selection checkboxes + "Delegate" button with team member dropdown
- Click-to-move between columns

### 3.2 Contracts (`/contracts`)
- Table: Title, Stakeholder, Value, Status, Dates
- Visual status pipeline (Drafting -> Sent -> Signed), click to advance
- "Add Contract" dialog
- Settings modal to customize stage labels (localStorage)

---

## Phase 4: AI Integrations (Client-Side - Updated)

**Important change**: All AI calls use the `@google/generative-ai` npm package directly in the browser, powered by `VITE_GEMINI_API_KEY`. No edge functions.

**Security note**: The API key will be visible in the client bundle. This is acceptable for internal/team dashboards. For public-facing apps, a backend proxy would be recommended.

### 4.1 Install Google Generative AI SDK
- Add `@google/generative-ai` package

### 4.2 Gemini Utility (`src/utils/gemini.ts`)
- Initialize `GoogleGenerativeAI` with `import.meta.env.VITE_GEMINI_API_KEY`
- Export helper functions:
  - `generateChecklist(taskDescription: string): Promise<string>` - calls `gemini-2.0-flash` to convert a description into a Markdown checklist
  - `draftFollowUpEmail(contractTitle, stakeholder, status): Promise<string>` - generates a polite follow-up email

### 4.3 Magic Checklist (in New Task form)
- "AI Checklist" button in the task creation dialog
- On click, sends task description to `generateChecklist()`
- Displays returned Markdown checklist below the description field
- Loading spinner while generating

### 4.4 Email Drafter (in Contracts view)
- "Draft Email" button on each contract row
- Calls `draftFollowUpEmail()` with contract details
- Shows generated email in a dialog with a "Copy to Clipboard" button

---

## Phase 5: Reusable Components

New shared components:
- `StatCard.tsx` - Metric card with icon, value, label
- `DataTable.tsx` - Sortable table wrapper
- `KanbanColumn.tsx` - Column container for task cards
- `TaskCard.tsx` - Individual task card
- `CurrencyToggle.tsx` - MAD/USD/EUR switcher
- `StatusPipeline.tsx` - Visual status stepper for contracts

---

## File Structure

```text
src/
  pages/
    Auth.tsx
    Dashboard.tsx
    Finance.tsx
    StipendManager.tsx
    Tasks.tsx
    Contracts.tsx
    Settings.tsx
  components/
    AppSidebar.tsx (updated)
    Layout.tsx (updated with auth guard)
    StatCard.tsx
    DataTable.tsx
    KanbanColumn.tsx
    TaskCard.tsx
    CurrencyToggle.tsx
    StatusPipeline.tsx
  hooks/
    useAuth.ts
  utils/
    gemini.ts
```

## Technical Summary

- **7 routes**: /, /auth, /dashboard, /finance, /tasks, /contracts, /settings
- **5 DB tables**: budgets, expenses, contracts, tasks + new stipends
- **AI**: Client-side `@google/generative-ai` SDK using `gemini-2.0-flash` model
- **State**: React Query for server data, useState for UI
- **Styling**: Dark theme with amber accents, Shadcn UI
- **Vercel compatible**: Standard Vite + React, no server-side dependencies

## Implementation Order

1. Auth + stipends table + sidebar update
2. Dashboard with budget/expense cards and charts
3. Stipend Manager table
4. Task Kanban board with delegation
5. Contracts tracker with pipeline
6. AI utility + checklist + email drafter
7. Settings page

