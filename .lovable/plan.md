
# Wire Up Founders Module

## Overview

Create the missing Founders infrastructure (layout, sidebar, pages) and connect everything via routing and the Home hub. This builds on the existing `StarRating` component and follows the same pattern as the Operations module.

---

## Files to Create

### 1. `src/components/FoundersSidebar.tsx`
Sidebar with two links, matching the OperationsSidebar pattern:
- **Source** (`/founders`) -- Manage Founders and Venture Associates
- **Tracking** (`/founders/tracking`) -- Log and view weekly progress

Uses `NavLink` with active styling, same as OperationsSidebar.

### 2. `src/components/FoundersLayout.tsx`
Layout wrapper identical to `OperationsLayout`:
- Auth guard (redirect to `/auth` if not logged in)
- `GlobalTopBar` at top
- `SidebarProvider` wrapping `FoundersSidebar` + main content area
- `SidebarTrigger` bar below the top bar

### 3. `src/pages/founders/Source.tsx`
Placeholder page with heading "Founders & Venture Associates" so the route resolves. The full CRUD implementation will come in a follow-up.

### 4. `src/pages/founders/Tracking.tsx`
Placeholder page with heading "Founders Tracking" so the route resolves. The full aggregated view and drill-down will come in a follow-up.

---

## Files to Update

### 5. `src/App.tsx`
Add two new routes and imports:
- `/founders` wrapping `FoundersSource` in `FoundersLayout`
- `/founders/tracking` wrapping `FoundersTracking` in `FoundersLayout`

### 6. `src/pages/Home.tsx`
Add a "Founders" card to the modules array:
- Title: "Founders"
- Description: "Track founder progress and venture associates."
- Icon: `Users` (use a different icon like `GraduationCap` to avoid conflict with Mentoring)
- Route: `/founders`
- Active: `true`

Update grid to `lg:grid-cols-5` to accommodate the 5th card, or keep `lg:grid-cols-4` for a balanced 2-row layout.

---

## Technical Notes

- The FoundersLayout follows the exact same auth-guard + sidebar pattern as OperationsLayout, keeping architecture consistent.
- Placeholder pages ensure routes work immediately; full CRUD and tracking features are a separate step.
- No new dependencies required.
