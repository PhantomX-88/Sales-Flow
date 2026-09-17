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

The development version may use local/mock data.

The production version must use Supabase as the persistent data layer.

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
* [ ] Create production PostgreSQL schema
* [ ] Configure Row Level Security
* [ ] Connect application to Supabase
* [ ] Replace local/mock data

## Phase 4 - Authentication

* [ ] Registration
* [ ] Login
* [ ] Logout
* [ ] Password reset
* [ ] Email verification
* [ ] Protected routes

## Phase 5 - Multi-Tenant SaaS

* [ ] Organizations
* [ ] Organization members
* [ ] Roles and permissions
* [ ] Organization-level data isolation
* [ ] Team management

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
