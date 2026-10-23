# SalesFlow QA and Error Report

Date: 2026-10-19

Latest verified commit: `01241a4` (`Finish dark theme status colors`)

## Executive summary

The application currently passes static validation and the declared domain test suite. Landing-page and authentication-page viewport checks showed no horizontal overflow at the tested sizes. The remaining high-value verification is blocked by test-environment setup: the local dev server is not staying available consistently, and no dedicated authenticated QA credentials are configured.

No database schema, authentication policy, or production data was changed during this audit.

## Confirmed issues and blockers

### QA-001 — Authenticated invitation tests cannot run

- Severity: High
- Status: Blocked by environment configuration
- Affected files: [`tests/invite-api.test.mjs`](./tests/invite-api.test.mjs), [`.env.local`](./.env.local)
- Evidence: `TEST_OWNER_TOKEN` and `TEST_ORG_ID` are not present in the local environment configuration.
- Impact: The following tests are skipped:
  - malformed organization ID
  - invalid email
  - complete invite/revoke/resend flow
  - resend token rotation flow
- Recommended fix: Use a dedicated non-production QA owner and organization, then provide the variables only to the local test process.

### QA-002 — Dev server lifecycle is unstable during API testing

- Severity: High
- Status: Environment/process issue
- Affected files: [`package.json`](./package.json), [`tests/invite-api.test.mjs`](./tests/invite-api.test.mjs)
- Evidence: Tests alternated between ports 3000 and 3004; later requests returned `ECONNREFUSED` because the server process was no longer listening.
- Impact: API tests cannot be trusted unless the test server remains available for the entire run.
- Recommended fix: Run one dedicated server on a fixed port, set `SALESFLOW_BASE_URL` to that port, and stop stale Next processes before testing.

### QA-003 — Test default URL can target the wrong server

- Severity: Medium
- Status: Confirmed test-harness risk
- Affected file: [`tests/invite-api.test.mjs`](./tests/invite-api.test.mjs)
- Evidence: The test defaults to `http://localhost:3000`; the active browser server was running on port 3004. This produced misleading 500/connection failures.
- Recommended fix: Require `SALESFLOW_BASE_URL` in the test command or add a documented fixed-port test script.

### QA-004 — Supabase RLS and cross-tenant isolation remain unverified

- Severity: Critical for production readiness
- Status: Not tested
- Affected files: [`supabase/schema.sql`](./supabase/schema.sql), [`supabase/tests/`](./supabase/tests), [`lib/supabase.ts`](./lib/supabase.ts), [`lib/server/supabase-admin.ts`](./lib/server/supabase-admin.ts)
- Evidence: No authorized QA accounts or test database session were available.
- Impact: Organization isolation, role enforcement, invitation acceptance, and deactivation behavior are not yet proven end-to-end.
- Recommended fix: Run the existing SQL regression suites against a non-production Supabase project with authorized test accounts.

## Fixed issues already committed

### FIX-001 — Dark-mode theme inconsistencies

Updated authentication, sidebar, team, settings, activity, stage badge, and probability-bar surfaces to use semantic theme tokens or explicit dark variants.

Relevant files:

- [`components/auth/auth-pages.tsx`](./components/auth/auth-pages.tsx)
- [`components/auth/accept-invite-page.tsx`](./components/auth/accept-invite-page.tsx)
- [`components/dashboard/sidebar.tsx`](./components/dashboard/sidebar.tsx)
- [`components/dashboard/team-view.tsx`](./components/dashboard/team-view.tsx)
- [`components/dashboard/opportunity-card.tsx`](./components/dashboard/opportunity-card.tsx)
- [`lib/utils.ts`](./lib/utils.ts)

### FIX-002 — Mobile landing-page KPI layout

The marketing dashboard preview now stacks KPI cards on narrow screens instead of forcing three cramped columns.

Affected file: [`components/marketing/dashboard-preview.tsx`](./components/marketing/dashboard-preview.tsx)

### FIX-003 — Production build depended on Google Fonts network access

Removed the build-time `next/font/google` dependency from [`app/layout.tsx`](./app/layout.tsx). The production build now works in an offline-restricted environment using the existing system-font fallback stack.

## Validation results

Passed:

- `npm.cmd test`: 10/10 tests passed.
- `npm.cmd run lint`: passed with no warnings or errors.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- Landing page horizontal-overflow checks: passed at 360, 390, 430, 768, 1024, 1280, 1440, and 1920px.
- Auth-route horizontal-overflow checks: passed at 360, 390, 430, 768, and 1024px.
- Dark-mode signup surface check: passed for background, card, heading contrast, and overflow.

Incomplete or blocked:

- Authenticated dashboard visual workflows: not completed.
- Full invitation API flow: skipped without QA credentials.
- Supabase SQL/RLS regression tests: not executed against a QA database.
- Cross-organization isolation testing: not executed.

## Recommended next sequence

1. Stop stale Next processes and run one fixed-port server.
2. Create a dedicated non-production Supabase QA owner and sales-rep account.
3. Run `tests/invite-api.test.mjs` with `SALESFLOW_BASE_URL`, `TEST_OWNER_TOKEN`, and `TEST_ORG_ID` set only in the local process.
4. Run the SQL suites under [`supabase/tests/`](./supabase/tests).
5. Exercise authenticated dashboard routes at mobile, tablet, and desktop sizes.
6. Add a dedicated Playwright dependency and repeatable visual test script if visual regression coverage is required.
7. Do not call the application production-ready until QA-001 through QA-004 are closed or explicitly accepted.

## Security note

Do not commit `.env.local`, Supabase access tokens, service-role keys, or email-provider keys. The report intentionally records only variable names and test outcomes, never secret values.
