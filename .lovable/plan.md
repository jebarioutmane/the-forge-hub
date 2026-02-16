

# Library Section for All Modules

## Overview

Add a "Library" link to every module sidebar and create a shared, reusable Library page component. Each module's library filters resources by its `module_name`. The existing `resource_library` Supabase table already has the right schema (`id`, `module_name`, `resource_name`, `url`, `created_at`).

---

## Files to Create

### 1. `src/pages/Library.tsx` -- Reusable Library Page

A single component that accepts a `moduleName` prop (e.g. `"Operations"`, `"Events"`, `"Founders"`).

**Data:**
- Fetches from `resource_library` where `module_name = moduleName` using React Query.
- Insert new resources with `module_name` pre-set.
- Delete resources by id.

**UI:**
- Heading: "{moduleName} Library"
- "Add Resource" button opens a small dialog/inline form with Name and URL inputs.
- Resource list: each item shows the name as a clickable link (`target="_blank"`, `rel="noopener noreferrer"`) with a delete button.
- Empty state when no resources exist.
- Matches the Slate Gray theme (Card with muted borders, same spacing as other module pages).

### 2. Three thin wrapper pages (one per module)

- `src/pages/operations/Library.tsx` -- renders `<Library moduleName="Operations" />`
- `src/pages/events/Library.tsx` -- renders `<Library moduleName="Events" />`
- `src/pages/founders/Library.tsx` -- renders `<Library moduleName="Founders" />`

---

## Files to Update

### 3. Sidebars -- Add "Library" link

Each sidebar gets one new item at the bottom of its nav list:

- **`src/components/OperationsSidebar.tsx`**: Add `{ title: "Library", url: "/operations/library", icon: BookOpen }`
- **`src/components/EventsSidebar.tsx`**: Add `{ title: "Library", url: "/events/library", icon: BookOpen }`
- **`src/components/FoundersSidebar.tsx`**: Add `{ title: "Library", url: "/founders/library", icon: BookOpen }`

Import `BookOpen` from `lucide-react`.

### 4. `src/App.tsx` -- Add three new routes

```text
/operations/library  --> OperationsLayout wrapping OperationsLibrary
/events/library      --> EventsLayout wrapping EventsLibrary
/founders/library    --> FoundersLayout wrapping FoundersLibrary
```

---

## Technical Details

- **Filtering**: Each query uses `.eq('module_name', moduleName)` so Operations Library only shows Operations resources, etc.
- **No database migration needed** -- `resource_library` table already exists with `id`, `module_name`, `resource_name`, `url`, `created_at`.
- **Add Resource form**: Simple Dialog with two fields (Name, URL). On submit, inserts a row and invalidates the React Query cache.
- **Links open in new tab**: All resource URLs render as `<a href={url} target="_blank" rel="noopener noreferrer">`.
- **Delete**: Trash icon button per resource, with confirmation or immediate delete + toast.

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/Library.tsx` | Create | Reusable library component with moduleName prop |
| `src/pages/operations/Library.tsx` | Create | Thin wrapper for Operations |
| `src/pages/events/Library.tsx` | Create | Thin wrapper for Events |
| `src/pages/founders/Library.tsx` | Create | Thin wrapper for Founders |
| `src/components/OperationsSidebar.tsx` | Update | Add Library nav item |
| `src/components/EventsSidebar.tsx` | Update | Add Library nav item |
| `src/components/FoundersSidebar.tsx` | Update | Add Library nav item |
| `src/App.tsx` | Update | Add 3 library routes |

