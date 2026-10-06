# SalesFlow

### B2B Sales Pipeline & Revenue Management SaaS

SalesFlow is a modern sales pipeline and revenue management platform designed to help sales teams manage leads, opportunities, activities, forecasts and revenue performance from one workspace.

The platform is designed for small and mid-sized businesses that need a practical sales CRM without the complexity and cost of traditional enterprise CRM platforms.

---

## Product Overview

SalesFlow provides a centralized workspace for managing the complete sales process:

**Lead → Discovery → Qualified → Proposal → Negotiation → Closed Won / Closed Lost**

The platform combines pipeline management, opportunity tracking, sales activities, revenue forecasting and sales performance analytics in a single interface.

---

## Core Features

### Sales Dashboard

* Total pipeline value
* Weighted forecast
* Open opportunities
* Closed revenue
* Win rate
* Average deal size
* Average sales cycle
* Revenue performance
* Pipeline funnel
* Monthly revenue trends

### Opportunity Management

* Create opportunities
* Edit opportunities
* Assign sales owners
* Track opportunity stages
* Track deal values
* Track probability
* Track expected close dates
* Track lead sources
* Record notes
* View opportunity history

### Pipeline Management

Supported stages:

| Stage       | Default Probability |
| ----------- | ------------------: |
| Lead        |                 10% |
| Discovery   |                 20% |
| Qualified   |                 40% |
| Proposal    |                 70% |
| Negotiation |                 85% |
| Closed Won  |                100% |
| Closed Lost |                  0% |

### Sales Performance

Sales managers can monitor:

* Individual sales performance
* Pipeline contribution
* Revenue contribution
* Opportunity ownership
* Activity levels
* Forecast performance

### Activities

SalesFlow supports activity tracking for:

* Calls
* Meetings
* Emails
* Follow-ups
* Notes
* Opportunity updates

---

# Technology Stack

SalesFlow is built around a modern web application architecture.

* **Next.js**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **shadcn/ui**
* **Recharts**
* **Lucide Icons**
* **GitHub**
* **Vercel**
* **Supabase**
* **PostgreSQL**

---

# Application Architecture

The intended production architecture is:

```text
Users
  │
  ▼
SalesFlow Web Application
  │
  ├── Next.js
  ├── Authentication
  ├── Dashboard
  ├── Pipeline
  ├── Opportunities
  ├── Activities
  └── Reports
  │
  ▼
Supabase
  │
  ├── Authentication
  ├── PostgreSQL Database
  ├── Row Level Security
  └── Storage
  │
  ▼
Cloud Infrastructure
  │
  └── Vercel
```

---

# Multi-Tenant SaaS Architecture

SalesFlow is intended to support multiple companies using the same application.

Each company should have its own organization/workspace.

Example:

```text
SalesFlow
│
├── Company A
│   ├── Users
│   ├── Accounts
│   ├── Opportunities
│   ├── Activities
│   └── Reports
│
├── Company B
│   ├── Users
│   ├── Accounts
│   ├── Opportunities
│   ├── Activities
│   └── Reports
│
└── Company C
    ├── Users
    ├── Accounts
    ├── Opportunities
    ├── Activities
    └── Reports
```

Every business record should be associated with an `organization_id`.

Row Level Security should ensure that users can only access records belonging to organizations they are authorized to access.

---

# Planned Database Structure

The production database is expected to contain tables similar to:

```text
profiles
organizations
organization_members
accounts
contacts
opportunities
pipeline_stages
activities
sales_targets
subscriptions
```

Core relationships:

```text
User
 │
 ▼
Organization Membership
 │
 ▼
Organization
 │
 ├── Accounts
 ├── Contacts
 ├── Opportunities
 ├── Activities
 ├── Pipeline Stages
 └── Sales Targets
```

---

# Authentication

The production version will use Supabase Auth.

Initial authentication:

* Email/password registration
* Login
* Logout
* Password reset
* Email verification

Future authentication options may include:

* Google
* Microsoft
* Single Sign-On
* Enterprise authentication

Supabase Auth supports password, magic-link, OTP, social login and SSO options.

---

# User Roles

SalesFlow is designed to support role-based permissions.

### Owner

Full organization access.

### Admin

Manage users, organization settings and CRM data.

### Sales Manager

Manage sales representatives, opportunities, pipeline and reports.

### Sales Representative

Manage assigned opportunities, accounts, contacts and activities.

### Viewer

Read-only access to permitted information.

---

# Organization Onboarding (Phase 1)

The authenticated application uses `organizations` and `organization_members` as its tenant boundary. Existing workspaces are migrated to organizations by preserving their IDs where possible; opportunity and activity records receive the mapped `organization_id`. Existing workspace creators become active owners, and legacy `member` memberships map to `sales_rep`.

Organization setup collects company name, industry, country, unique lowercase tag, expected sub-user count, revenue target and currency, target period, expected deals per month, average deal size, team type, and enabled optional features. Tags are 3-20 lowercase letters, numbers, or hyphens and are unique case-insensitively. Owners can edit these values in Settings. The Features step can be skipped and revisited later.

The onboarding and Settings writes use the `save_organization_setup` security-definer RPC. Tag availability is checked by `is_organization_tag_available`; the unique index remains authoritative under concurrent requests. Organization setup changes are recorded in `audit_log`. Organization RLS is active. Until the later sub-user-permission phase is implemented, CRM table reads and writes are owner-only.

Before using this phase against a hosted database, run the current `supabase/schema.sql` in the Supabase SQL Editor. The migration aborts if it finds unmapped records, duplicate active organization memberships, organizations without an active owner, or conflicting tags; resolve those rows before rerunning it. Do not apply an earlier copy of the schema.

Current role values are `owner`, `sales_rep`, `admin`, `sales_manager`, and `viewer`. Only `owner` and `sales_rep` are used by the new organization flow; the other existing roles are preserved for later phases.

---

# Team Management & Invitations (Phase 2)

## Roles

| Role | Who | Access |
| --- | --- | --- |
| `owner` | Super admin; the organization's first user | Full org data, Team page, invitations, member management |
| `sales_rep` | Invited sub-user | Only their own opportunities, activities and personal target |
| `admin` / `sales_manager` / `viewer` | Reserved for later phases | Present in the schema, currently unused |

## Rules enforced in Postgres (never UI-only)

* Every business table carries `organization_id`; RLS scopes every query to the caller's organization.
* One active organization per user (`organization_members_one_active_org_per_user_uidx`).
* An organization can never lose its last active owner — enforced by the `set_member_status` RPC **and** the `organization_members_last_owner_guard` trigger (which also blocks direct/service-role writes).
* `opportunities.owner_id` and `created_by` are filled by the `opportunities_ownership_guard` trigger. `organization_id` and `created_by` are immutable, `owner_id` cannot be cleared, and only an owner may reassign `owner_id`. The legacy `owner` display text is kept in sync automatically.
* Invitations: a raw 32-byte token is **never stored** — only its SHA-256 hash (`invitations.token_hash`). One pending invitation per `(organization, email)`. The role is always read from the invitation row (`role = 'sales_rep'` is a CHECK constraint); it never comes from the client. Clients have SELECT-only access; all writes go through server routes or RPCs.
* `accept_invitation(raw_token)` (SECURITY DEFINER) locks the row with `SELECT ... FOR UPDATE`, then validates: status `pending`, not expired, `auth.jwt()` email equals the invited email, and no active membership in another organization. It then atomically creates the membership (role from the row), creates the personal `sales_targets` row, marks the invitation accepted and writes `audit_log`. Re-accepting as the same user is idempotent; any other user is rejected by the email check, so a used token cannot grant access twice. Two simultaneous accepts serialize on the row lock — exactly one succeeds.
* Deactivating a member revokes access immediately (all RLS helper functions require `status = 'active'`). Their records stay; they can be reactivated later.
* Rate limits: 20 invitations per organization per hour; 1 initial send + 3 resends per invitation. Every resend rotates the token, so the previous link dies instantly.

## Server routes (the only service-role consumers)

| Route | Purpose |
| --- | --- |
| `POST /api/team/invite` | Verify caller is an active owner, create + email the invitation |
| `POST /api/team/resend` | Rotate token, extend expiry by 7 days, re-email (max 3 resends) |
| `POST /api/team/revoke` | Kill a pending invitation immediately |
| `GET /api/invite/lookup?token=` | Public token validation for the `/accept-invite` screen |

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | existing |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client + server | existing |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** — never `NEXT_PUBLIC_` | used by the routes above; each route verifies the caller is an active owner first |
| `SITE_URL` | server | base URL for invitation links (e.g. `https://sales-flow-ruby.vercel.app`) |
| `RESEND_API_KEY` | server | invitation email delivery (optional in local dev — the accept link is returned in the API response instead) |
| `RESEND_FROM` | server (optional) | sender identity; defaults to `SalesFlow <onboarding@resend.dev>` (Resend test sender — configure a real verified domain for production) |

## Manual setup checklist

1. **Email deliverability**: Resend (or SMTP) with a verified sending domain and healthy DNS — SPF, DKIM and DMARC — so invitations land in Gmail, Yahoo and corporate inboxes instead of spam.
2. **Env vars** on Vercel *and* locally in `.env.local`: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (or SMTP equivalent), `SITE_URL`, `RESEND_FROM`.
3. **Supabase Auth → URL Configuration**: add `http://localhost:3000/accept-invite` and `https://your-domain/accept-invite` as redirect URLs so email confirmation returns users to the invitation with the same token.
4. **Scheduled job** (pg_cron or Vercel Cron): run `select expire_stale_invitations();` nightly (invite expiry) — the accept path and invite routes also sweep on read, so this is a safety net. The 30-day soft-delete purge arrives with Phase 5.
5. **Run the tests**: `supabase/tests/phase2-tests.sql` in the SQL Editor (expect `ALL PHASE 2 TESTS PASSED`), then `node --test tests/invite-api.test.mjs` with `TEST_OWNER_TOKEN` and `TEST_ORG_ID` set while `npm run dev` runs.
6. **Two-tab concurrency check**: open the same accept link in two browsers signed in as the invited user — exactly one accept should succeed; the other sees an idempotent success or an "already been used" error.

---

# Development

## Requirements

Recommended development environment:

* Node.js
* npm
* Git
* GitHub account
* Supabase account
* Vercel account

---

## Install

Clone the repository:

```bash
git clone https://github.com/PhantomX-88/Sales-Flow.git
```

Move into the project:

```bash
cd Sales-Flow
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Environment Variables

Create a local environment file:

```text
.env.local
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Never commit `.env.local` or secret credentials to GitHub.

Supabase's current Next.js documentation uses these environment variables for the browser-side project URL and publishable key.

## Supabase Setup

1. Create a Supabase project and copy its project URL and publishable key into `.env.local`.
2. Open the Supabase SQL Editor and run the entire [`supabase/schema.sql`](supabase/schema.sql) file. It creates the workspace RPC and refreshes the API schema cache. If you ran an older version already, run the current file again.
3. In Authentication settings, choose whether new accounts must confirm their email address. If confirmation is enabled, users confirm their email before signing in.
4. In **Authentication → URL Configuration**, set the Site URL to your deployed app URL and add these Redirect URLs:
  - `http://localhost:3000/reset-password` for local development.
  - `https://your-deployed-domain/reset-password` for production, replacing the domain with your Vercel domain.
5. Start the app with `npm run dev`, create an account, and complete the workspace setup screen.
6. For Vercel, add the same two `NEXT_PUBLIC_*` variables to the production environment before deploying.

The publishable key is safe for browser use because Row Level Security protects the tables. Never put a service-role key in `.env.local` or client code.

---

# Production Deployment

SalesFlow is intended to be deployed using:

```text
GitHub
   ↓
Vercel
   ↓
Production Next.js Application
   ↓
Supabase
   ↓
PostgreSQL + Authentication
```

Every push to the production branch can trigger a new deployment through the GitHub/Vercel integration.

---

# Data Strategy

Supabase is the only application data source. Authentication uses Supabase Auth, while workspaces, members, opportunities and activities are stored in Postgres. Row Level Security scopes every query and mutation to the authenticated user's workspace.

The former bundled `sales-data.json` demo dataset has been removed. New workspaces start empty and users add their own opportunities.

Production data should include:

* Organizations
* Users
* Accounts
* Contacts
* Opportunities
* Activities
* Pipeline stages
* Sales targets
* Forecast data
* Subscription information

The application should not depend on a local JSON file for production CRM data.

---

# Security

SalesFlow must follow these principles:

* Never commit secrets
* Use environment variables
* Enable Supabase Row Level Security
* Enforce organization-level data isolation
* Validate user permissions server-side
* Protect authenticated routes
* Validate user input
* Use secure authentication sessions
* Avoid exposing service-role credentials to the browser

Supabase recommends reviewing Row Level Security policies before putting an application using real user data into production.

---

# Responsive Design

SalesFlow is designed to provide the same core product experience across:

* Desktop
* Laptop
* Tablet
* Mobile

The interface should adapt to the available screen size without creating completely separate versions of the application.

---

# Product Roadmap

> **Verification note:** Checked items were verified against the codebase and `supabase/schema.sql`. Phases 3–5 progressed ahead of Phase 2 because the prototype was migrated to Supabase before hosting was set up. "Roles and permissions" remains open: all five role values exist, but CRM access is currently owner-only until the sub-user permission phase ships. External steps (Supabase project creation, Vercel deployment) are checked only when confirmed.

## Phase 1 - Code Ownership

* [x] Build application
* [x] Export application
* [x] Create GitHub repository
* [x] Push application to GitHub

## Phase 2 - Production Hosting

* [ ] Connect GitHub to Vercel
* [ ] Deploy production application
* [ ] Configure environment variables
* [ ] Configure production domain
* [ ] Test production build

## Phase 3 - Cloud Database

* [ ] Create Supabase project
* [x] Create production PostgreSQL schema
* [x] Configure Row Level Security
* [x] Connect application to Supabase
* [x] Replace local/mock data

## Phase 4 - Authentication

* [x] Registration
* [x] Login
* [x] Logout
* [x] Password reset
* [x] Email verification
* [x] Protected routes

## Phase 5 - Multi-Tenant SaaS

* [x] Organizations
* [x] Organization members
* [ ] Roles and permissions
* [x] Organization-level data isolation
* [x] Team management

## Phase 6 - Commercial SaaS

* [ ] Free plan
* [ ] Business plan
* [ ] Pro/advanced plan
* [ ] Subscription management
* [ ] Payment processing
* [ ] Usage limits
* [ ] Upgrade/downgrade flows

## Phase 7 - Growth

* [ ] Custom domains
* [ ] Email notifications
* [ ] Sales automation
* [ ] CRM integrations
* [ ] WhatsApp integrations
* [ ] Reporting
* [ ] AI sales assistant
* [ ] Advanced forecasting
* [ ] API
* [ ] Webhooks

---

# Product Principle

SalesFlow should remain:

**Simple enough for a small sales team.**

**Powerful enough for a growing business.**

**Affordable enough to replace spreadsheets and expensive CRM platforms.**

The long-term objective is to provide an accessible sales operating system for small and mid-sized businesses.

---

# Repository

GitHub:

https://github.com/PhantomX-88/Sales-Flow

---

# Status

**Current Status:** Development / Production Migration

The application is being migrated from a prototype environment into a production-ready multi-tenant SaaS architecture.

---

# Maintainer

SalesFlow

Built for modern B2B sales teams.
