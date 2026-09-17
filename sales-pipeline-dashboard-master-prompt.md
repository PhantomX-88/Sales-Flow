# Pixel-Perfect Interactive Sales Pipeline Dashboard
## Master Build Prompt

Act as a **senior SaaS product designer, UX engineer, frontend architect, and Next.js developer with 10+ years of experience building enterprise CRM and revenue-management platforms.**

Build a **production-quality, pixel-perfect, fully interactive Sales Pipeline Overview & Management Dashboard**.

Do not give me a tutorial, explanation, mockup, or pseudo-code.

**Build the complete working application.**

---

## 1. Technology Stack

Use exactly:

- Next.js 14+
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts
- Lucide React icons
- React hooks for client-side interactions

Do not introduce unnecessary frameworks or dependencies.

Use clean, maintainable, strongly typed TypeScript.

---

## 2. Product Objective

Create a modern B2B sales management dashboard for Sales Managers, Sales Directors, Founders, and Revenue Operations teams.

The dashboard must allow users to:

- View total pipeline value
- Monitor sales performance
- Understand pipeline health
- Track opportunities
- Manage sales stages
- Forecast revenue
- Identify stalled and overdue deals
- Monitor sales activity
- Search opportunities
- Filter opportunities
- Sort opportunities
- Create opportunities
- Edit opportunities
- Move opportunities through pipeline stages
- View individual opportunity details
- Monitor salesperson performance
- Export pipeline data

The product should feel like a premium enterprise SaaS application.

Take UX inspiration from products such as HubSpot, Salesforce, Linear, Attio, Stripe, Ramp, and Notion, but do not copy their branding or visual identity.

---

# 3. Design Direction

Use a clean, premium B2B SaaS aesthetic.

### Visual characteristics

- White primary surfaces
- Very light slate/gray application background
- Dark navy/charcoal typography
- Blue primary action color
- Subtle borders
- Minimal shadows
- Rounded cards
- Excellent whitespace
- Dense but readable information hierarchy
- Professional enterprise appearance
- No unnecessary gradients
- No excessive animation

The dashboard should look suitable for a real company managing substantial sales revenue.

---

# 4. Application Architecture

Use a modular component architecture.

Recommended structure:

```text
/app
  layout.tsx
  page.tsx
  globals.css

/components
  /dashboard
    sidebar.tsx
    topbar.tsx
    metric-card.tsx
    pipeline-chart.tsx
    pipeline-funnel.tsx
    opportunity-table.tsx
    opportunity-card.tsx
    activity-feed.tsx
    sales-performance.tsx
    forecast-card.tsx
    create-opportunity-dialog.tsx
    opportunity-detail-drawer.tsx
    filters.tsx
    empty-state.tsx
    loading-skeleton.tsx

/components/ui
  shadcn components

/lib
  utils.ts
  mock-data.ts
  types.ts
```

Keep components modular.

Do not put the entire application into one huge component.

---

# 5. Main Dashboard Layout

Desktop layout:

```text
┌──────────────────────────────────────────────────────────────┐
│                         TOP BAR                               │
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│   SIDEBAR     │                MAIN CONTENT                   │
│               │                                              │
│   Overview    │   Page Header                                │
│   Pipeline    │                                              │
│   Accounts    │   KPI Cards                                  │
│   Activities  │                                              │
│   Forecast    │   Revenue Chart       Pipeline Funnel        │
│               │                                              │
│   Tasks       │   Opportunity Pipeline Table                │
│   Settings    │                                              │
│               │   Activity + Sales Performance               │
│   User        │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

---

# 6. Sidebar

Create a fixed desktop sidebar approximately 240-260px wide.

Logo:

```text
S
SalesFlow
Revenue OS
```

Navigation:

### Workspace

- Overview
- Pipeline
- Accounts
- Activities
- Forecast

### Management

- Tasks
- Settings

Every navigation item must:

- Have an icon
- Have hover state
- Have active state
- Have keyboard focus state
- Be clickable

Active state:

- Soft blue background
- Blue icon
- Blue text
- Slightly stronger font weight

Bottom of sidebar:

```text
EA
Emmanuel A.
Sales Manager
```

Include a user dropdown.

On mobile, convert the sidebar into a slide-out drawer.

---

# 7. Top Navigation

Create a sticky top bar.

### Left

Search field:

```text
Search opportunities...
```

Search must actually filter opportunities.

### Right

- Notifications
- Export
- New Opportunity
- User/avatar menu

---

# 8. Page Header

Main heading:

```text
Pipeline overview
```

Supporting copy:

```text
Monitor deal health, forecast revenue, and move opportunities forward.
```

Controls:

- This quarter
- Last quarter
- This year
- Filter

Primary CTA:

```text
+ New opportunity
```

---

# 9. KPI Cards

Create four premium KPI cards.

### Pipeline Value

```text
Pipeline value
$1.24M
+18.6%
vs previous quarter
```

### Weighted Forecast

```text
Weighted forecast
$486K
+12.4%
at current probability
```

### Open Opportunities

```text
Open opportunities
142
+7
this quarter
```

### Win Rate

```text
Win rate
24.8%
+3.2%
vs previous quarter
```

Each card must include:

- Icon
- Primary value
- Trend
- Supporting label
- Hover state
- Subtle transition
- Responsive layout

Do not hardcode derived metrics. Calculate them from the data.

---

# 10. Pipeline & Revenue Chart

Use Recharts.

Title:

```text
Pipeline & Revenue
```

Subtitle:

```text
Pipeline movement over the last 6 months
```

Months:

- April
- May
- June
- July
- August
- September

Display:

- Pipeline value
- Closed revenue

Use:

- ResponsiveContainer
- AreaChart or LineChart
- CartesianGrid
- XAxis
- YAxis
- Tooltip
- Legend

The tooltip must be professionally styled.

Format currency correctly.

The chart must resize correctly across desktop, tablet, and mobile.

---

# 11. Pipeline Funnel

Create a visual funnel.

Stages:

```text
Lead
Qualified
Proposal
Negotiation
Closed Won
```

Example counts:

```text
Lead          248
Qualified     142
Proposal       76
Negotiation    41
Closed Won     24
```

Display:

- Opportunity count
- Pipeline value
- Conversion rate

Show conversion between stages.

---

# 12. Opportunity Management

Create the main opportunity management section.

Header:

```text
Opportunities
```

Controls:

- Search
- Stage filter
- Owner filter
- Value filter
- Date filter
- Reset filters

Table columns:

```text
Opportunity
Account
Stage
Value
Probability
Owner
Age
Last activity
Actions
```

Use realistic B2B data supplied in the accompanying JSON data file.

---

# 13. Stage Badges

Use restrained visual states.

### Discovery

Gray

### Qualified

Light blue

### Proposal

Blue

### Negotiation

Indigo

### Closed Won

Green

### Closed Lost

Red

Avoid overly saturated colors.

---

# 14. Opportunity Detail Drawer

Clicking an opportunity must open a right-side detail drawer.

Display:

```text
Opportunity
Meridian Health

$84,000
Proposal
70% probability
```

Sections:

### Opportunity Details

- Company
- Contact
- Email
- Phone
- Owner
- Value
- Probability
- Expected close date
- Created date
- Lead source
- Notes

### Timeline

Show recent activities.

### Actions

- Edit
- Add activity
- Change stage
- Mark as Won
- Mark as Lost

---

# 15. Kanban Pipeline View

Create a pipeline Kanban view.

Stages:

```text
Discovery
Qualified
Proposal
Negotiation
Closed Won
```

Opportunity cards display:

- Company
- Contact
- Value
- Probability
- Owner
- Age

Allow users to move opportunities between stages.

When the stage changes:

1. Update the opportunity.
2. Automatically update probability according to stage unless the user has manually overridden probability.
3. Update pipeline metrics.
4. Update funnel data.
5. Display a toast notification.

Use native drag-and-drop or a lightweight implementation.

Do not add a heavy drag-and-drop library unless necessary.

---

# 16. Create Opportunity

Clicking:

```text
+ New opportunity
```

opens a shadcn Dialog.

Fields:

```text
Company name
Contact name
Email
Phone
Deal value
Stage
Probability
Expected close date
Lead source
Owner
Notes
```

Validation:

- Company required
- Deal value required
- Stage required

After submission:

- Add the opportunity to state
- Close dialog
- Update metrics
- Update table
- Update Kanban
- Update funnel
- Show toast

Example:

```text
Opportunity created successfully.
```

---

# 17. Edit Opportunity

Allow users to edit:

- Company
- Contact
- Email
- Phone
- Value
- Stage
- Probability
- Owner
- Close date
- Lead source
- Notes

Saving must immediately update the dashboard.

---

# 18. Sales Performance

Create:

```text
Sales performance
```

Show salesperson rankings.

Columns:

| Rep | Pipeline | Won | Win Rate |
|---|---:|---:|---:|
| Emmanuel A. | $428K | $118K | 31% |
| Tolu K. | $392K | $104K | 28% |
| Janet M. | $286K | $76K | 26% |
| John D. | $214K | $58K | 23% |

Use a compact Recharts horizontal bar chart.

---

# 19. Recent Activity

Create an activity feed.

Examples:

```text
Proposal sent to Meridian Health
18 min ago

Amina Yusuf moved Northstar Logistics to Negotiation
1 hr ago

New qualified lead from LinkedIn
2 hrs ago

Follow-up overdue for Vertex Systems
4 hrs ago
```

Use icons according to activity type.

---

# 20. Forecast

Create a forecast card.

Display:

```text
Quarterly target
$750K

Closed revenue
$428K

Commit
$196K

Best case
$284K

Gap to target
$322K
```

Include:

- Progress bar
- Percentage achieved
- Forecast confidence

Example:

```text
57% of quarterly target achieved
```

---

# 21. Search

Global search must work.

Search should check:

- Company
- Contact
- Owner
- Stage
- Lead source

Example:

```text
Meridian
```

must filter the opportunity list immediately.

Create a useful empty state when there are no results.

---

# 22. Filtering

Implement functional filters.

### Stage

```text
All stages
Discovery
Qualified
Proposal
Negotiation
Closed Won
Closed Lost
```

### Owner

Use the owners from the JSON data.

### Value

```text
All values
Under $25K
$25K-$50K
$50K-$100K
Over $100K
```

### Date

Allow filtering by expected close date or created date.

Filters must combine.

Example:

```text
Stage = Proposal
Owner = Emmanuel A.
Value = $50K-$100K
```

must return only matching opportunities.

---

# 23. Sorting

Allow sorting by:

- Opportunity
- Value
- Probability
- Age
- Expected close date
- Last activity

Support ascending and descending order.

Display a visual sort indicator.

---

# 24. Pagination

Implement pagination.

Display:

```text
Showing 1-10 of 142 opportunities
```

Controls:

```text
Previous
1
2
3
...
Next
```

Pagination must actually work.

---

# 25. Export

Export the currently filtered opportunities as CSV.

Columns:

```text
Company
Contact
Email
Phone
Stage
Value
Probability
Owner
Age
Expected Close Date
Lead Source
Last Activity
```

Implement client-side CSV generation.

Do not fake the export interaction.

---

# 26. Responsive Design

The same application must work across:

- Desktop 1440px+
- Laptop 1024px+
- Tablet 768px+
- Mobile 375px+

Do not create a separate mobile application.

Maintain the same core functionality across all devices.

### Mobile

- Sidebar becomes drawer
- KPI cards stack
- Charts resize
- Tables become horizontally scrollable or responsive cards
- Filters collapse into a dialog/sheet
- Detail drawer becomes a full-screen sheet
- Buttons remain accessible
- No page-level horizontal overflow

Do not remove core functionality on mobile.

---

# 27. Interaction Design

Everything that looks interactive must work.

Implement:

- Navigation
- Search
- Filters
- Sorting
- Pagination
- Dialogs
- Drawers
- Forms
- Tabs where appropriate
- Kanban movement
- Notifications
- Export
- Opportunity creation
- Opportunity editing
- Stage changes

Avoid dead buttons.

---

# 28. Micro-Interactions

Use subtle transitions around 150-200ms.

Apply to:

- Cards
- Buttons
- Navigation
- Rows
- Opportunity cards
- Drawer/dialog opening

Avoid excessive animation.

---

# 29. Loading States

Create skeleton loading states for:

- KPI cards
- Charts
- Opportunity table
- Activity feed

Use shadcn-style skeleton components.

---

# 30. Empty States

Example:

```text
No opportunities found

Try changing your filters or search terms.

Clear filters
```

---

# 31. Error States

Example:

```text
Something went wrong

We couldn't load your pipeline data.

Try again
```

---

# 32. Notifications

Use shadcn-style toast notifications.

Examples:

```text
Opportunity created successfully.
Opportunity updated.
Stage changed to Negotiation.
CSV export started.
```

---

# 33. TypeScript Data Model

Create strongly typed data structures.

Example:

```ts
type PipelineStage =
  | "Discovery"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost"

interface Opportunity {
  id: string
  company: string
  contact: string
  email?: string
  phone?: string
  stage: PipelineStage
  value: number
  probability: number
  owner: string
  age: number
  expectedCloseDate: string
  createdDate: string
  lastActivity: string
  leadSource: string
  notes?: string
}
```

Use the provided `sales-data.json` as the primary mock data source.

---

# 34. State Management

Do not introduce Redux unless absolutely necessary.

Use:

```text
useState
useMemo
useCallback
```

Centralize dashboard state appropriately.

Any opportunity change must update:

- KPI metrics
- Funnel
- Opportunity table
- Kanban
- Forecast
- Sales performance where applicable

---

# 35. Currency

Use USD for the initial prototype.

Examples:

```text
$84,000
$126,000
$1.24M
```

Create reusable currency formatting functions.

Do not manually concatenate currency strings throughout components.

---

# 36. Accessibility

Follow accessibility best practices.

Ensure:

- Icon buttons have aria-labels
- Inputs have labels
- Dialogs have titles
- Keyboard navigation works
- Focus states are visible
- Good color contrast
- Semantic HTML
- Proper table structure
- Interactive elements are keyboard accessible

---

# 37. Performance

Optimize for:

- Fast initial render
- Minimal unnecessary re-renders
- Efficient filtering
- Efficient sorting
- Memoized derived calculations
- Responsive charts
- Component reuse

Use `"use client"` only for components requiring browser-side interaction.

---

# 38. Pixel-Perfect Requirement

Visual accuracy is a primary requirement.

Pay close attention to:

- Spacing
- Padding
- Margins
- Typography
- Line height
- Border radius
- Icon dimensions
- Alignment
- Table row height
- Sidebar width
- Header height
- Chart proportions
- Button dimensions
- Responsive breakpoints

Use an 8px spacing system where practical.

The dashboard must look intentionally designed rather than assembled from generic components.

---

# 39. Typography

Use a modern SaaS typography system.

Recommended:

```text
Inter
```

Hierarchy:

```text
Page title: 28-32px / 700
Section title: 15-18px / 600
Body: 14px
Supporting text: 12-13px
KPI: 26-30px / 700
```

Do not overuse bold typography.

---

# 40. Design Tokens

Centralize colors.

Primary:

```text
#2563EB
```

Background:

```text
#F8FAFC
```

Primary text:

```text
#0F172A
```

Secondary text:

```text
#64748B
```

Border:

```text
#E2E8F0
```

Success:

```text
Emerald
```

Warning:

```text
Amber
```

Danger:

```text
Rose
```

Keep the interface visually restrained.

---

# 41. shadcn/ui

Use shadcn/ui patterns for:

- Button
- Card
- Dialog
- Drawer/Sheet
- Dropdown Menu
- Input
- Select
- Tabs
- Badge
- Tooltip
- Toast
- Skeleton

If a component is unavailable, create a local component following shadcn conventions.

---

# 42. Recharts

Use Recharts for charts.

Use:

```tsx
ResponsiveContainer
```

Charts must never use fixed widths.

Use professionally styled tooltips.

---

# 43. Mobile Table

Never allow the entire page to overflow horizontally.

For smaller screens, use:

```css
overflow-x-auto
```

around wide data tables where necessary.

Alternatively transform rows into responsive cards.

Every important field and action must remain accessible.

---

# 44. Dark Mode

Do not prioritize dark mode in the first version.

However, structure CSS variables so dark mode can be introduced later without rewriting components.

---

# 45. Data Architecture

Keep:

- Types in `lib/types.ts`
- Mock data in `lib/mock-data.ts`
- Formatting/helper functions in `lib/utils.ts`
- UI components in `components/dashboard`

Do not mix data definitions into large UI components.

---

# 46. Dynamic Dashboard Calculations

Calculate all derived metrics from the dataset.

### Pipeline Value

```text
SUM(open opportunity values)
```

### Weighted Forecast

```text
SUM(value × probability / 100)
```

### Open Opportunities

```text
COUNT(all open opportunities)
```

### Win Rate

```text
closed won / total closed opportunities × 100
```

### Average Deal Size

```text
total closed won value / closed won opportunity count
```

### Average Sales Cycle

Calculate from created date and closed date where available.

Metrics must change automatically when the user creates, edits, deletes, or moves opportunities.

---

# 47. UX Quality

Use:

- Tooltips for unfamiliar icons
- Confirmation for destructive actions
- Clear primary actions
- Sticky table headers where useful
- Consistent spacing
- Hover states
- Focus states
- Empty states
- Loading states
- Error states

Avoid unnecessary modal overload.

Use drawers for detailed opportunity views.

---

# 48. Backend Readiness

This is initially a frontend prototype using local JSON/mock data.

Do not pretend that authentication or backend persistence exists.

Structure the code so the JSON/mock data can later be replaced by:

```text
REST API
GraphQL
Supabase
PostgreSQL
Firebase
```

without rebuilding the UI architecture.

---

# 49. Code Quality

Requirements:

- TypeScript strict mode
- No unnecessary `any`
- No duplicated business logic
- No unnecessary dependencies
- No dead components
- No fake buttons
- No broken imports
- No console errors
- No TypeScript errors
- No hydration errors

Use semantic component names.

---

# 50. Final QA

Before finishing, perform a virtual product QA.

### Functional QA

Verify:

- Search works
- Filters work
- Combined filters work
- Sorting works
- Pagination works
- Create opportunity works
- Edit opportunity works
- Stage changes work
- Kanban movement works
- Detail drawer works
- Export works
- Notifications work
- Navigation states work

### Visual QA

Verify:

- No broken layouts
- No page-level horizontal overflow
- No clipped text
- No inconsistent spacing
- No broken icons
- No chart overflow
- No mobile layout problems
- No unusable touch targets

### Technical QA

Run:

```bash
npm run build
```

Resolve all:

- Build errors
- TypeScript errors
- ESLint issues affecting the implementation
- Hydration errors

---

# 51. Critical Implementation Rule

Do NOT stop after creating the layout.

Do NOT provide only a component structure.

Do NOT provide pseudo-code.

Do NOT create fake interactions.

Do NOT leave placeholder comments such as:

```text
// implement later
```

Actually implement the dashboard.

Every major interaction must work with realistic local state and the supplied JSON data.

---

# 52. Final Project Requirements

The finished project must include:

```text
package.json
Next.js configuration
TypeScript configuration
Tailwind configuration
App Router
Global CSS
shadcn/ui components
Dashboard components
Mock data integration
Type definitions
Utility functions
Responsive layout
Interactive Recharts charts
Interactive opportunity management
Search
Filtering
Sorting
Pagination
CSV export
Create/Edit opportunity
Opportunity detail drawer
Kanban pipeline
Forecast
Sales performance
Activity feed
Responsive mobile experience
```

The application must run with:

```bash
npm install
npm run dev
```

and display a polished, responsive, interactive Sales Pipeline Overview & Management Dashboard.

---

# 53. Success Criteria

The implementation is successful only if a user can immediately:

1. Understand total pipeline health.
2. See forecast revenue.
3. Identify opportunities requiring attention.
4. Search and filter deals.
5. Open an opportunity.
6. Edit an opportunity.
7. Create a new opportunity.
8. Move an opportunity through pipeline stages.
9. See dashboard metrics update dynamically.
10. Export filtered pipeline data.
11. Use the same core application comfortably on desktop, tablet, and mobile.

**Build it as a real SaaS dashboard, not a visual demo.**
