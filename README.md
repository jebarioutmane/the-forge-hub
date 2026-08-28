# The Forge Hub (Personal Initiative for coding experience)

An internal program-management platform for **The Forge**, a venture accelerator at **UM6P** (Mohammed VI Polytechnic University, Morocco). The Forge Hub runs the entire acceleration program from a single, cohort-aware workspace — founders, events, operations, reporting, and secure external access.

Built as a personal initiative to replace scattered spreadsheets with one connected source of truth.

## What it does

- **Founders** — A filterable directory, weekly progress tracking, formal evaluations, and a live portfolio dashboard. Founders are assessed on trajectory and stage-relative momentum, not a flat scorecard.
- **Events** — A calendar with a unified per-event workspace (attendance, logistics, stakeholders, checklist), support for multi-part events with per-session attendance, and a stakeholder CRM.
- **Operations** — One connected money flow: a trader-view budget (allocated / committed / spent / remaining) fed by expenses, stipends, and contract payments, plus a team task board.
- **Reporting** — Reusable report templates mixing auto-computed metrics with manual questions; launch for any period and export to PDF or Excel.
- **Command Center** — A daily overview with weekly focuses, a founder leaderboard, upcoming events, birthdays, and a global network map.

## Key characteristics

- **Cohort-aware throughout** — a cohort switcher scopes the whole platform, with a full lifecycle (Upcoming → Active → Closed).
- **Automatic audit history** — every change on every table is logged.
- **Role-based access control** — custom roles with per-page, per-action permissions, enforced at the database level. External parties (e.g. sponsors) can be given cohort-scoped, read-only access with sensitive data protected server-side.
- **Automations** — attendance flows into engagement and risk scoring, which can generate follow-up tasks.

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Row-Level Security)
- **Built with:** Lovable

## Security

Access control and data isolation are enforced at the database layer via PostgreSQL Row-Level Security, not just in the UI. Sensitive founder data is stored in an internal-only table and is never exposed to external roles.

## Status

Actively developed. Being adopted as the program's management system starting with the next cohort.

---

*The Forge · UM6P*


___

# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
