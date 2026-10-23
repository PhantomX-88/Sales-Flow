# QA Follow-up

This folder tracks audit work that cannot be closed from the repository alone.
Never commit QA tokens, `.env.local`, service-role keys, or provider credentials.

## Resolved in this pass

- **QA-002: Dev server lifecycle/port ambiguity.** Start the API test server with
  `npm run dev:qa`; it binds to port 3010. The invite suite uses that port by
  default. Set `SALESFLOW_BASE_URL` only when intentionally targeting another
  server. Keep that server running for the entire test run.
- **QA-003: Test default targeting the wrong server.** The API suite now defaults
  to the dedicated QA port, and `npm run test:invite` provides a repeatable entry
  point.

## Blocked: QA-001 authenticated invitation tests

Requires an authorized, non-production Supabase QA organization and active
owner. Keep credentials in the local process environment, never in source or
this folder.

1. Configure the local app with the non-production Supabase URL and publishable
   key, plus the required server-side invitation email configuration if testing
   delivery.
2. Start `npm run dev:qa` and leave it running.
3. Set `TEST_OWNER_TOKEN` and `TEST_ORG_ID` in the test process environment.
4. Run `npm run test:invite` and confirm no credential-dependent cases are
   skipped; capture only pass/fail and skip counts here, never credential values.
5. Revoke/delete disposable QA invitations and credentials after the run.

## Blocked: QA-004 Supabase RLS and tenant isolation

Requires access to a dedicated non-production Supabase project and authorized
test accounts for at least two organizations, including owner and sales-rep
memberships.

1. Confirm the project is non-production and the schema/migrations match the
   repository revision under test.
2. Run `supabase/tests/phase2-tests.sql` through `supabase/tests/phase6-tests.sql`
   in the documented order, using the SQL editor or authorized database test
   connection.
3. Verify cross-organization reads and writes are denied, then verify invite
   acceptance, member deactivation, role restrictions, reassignment, and
   deletion-request behavior for each applicable role.
4. Record suite results, project/schema revision, and any failures without
   recording personal data or secrets.

## Observed: invitation lookup returns 500

The local run against `http://127.0.0.1:3010` returned
`{"error":"Could not look up this invitation."}` for an unknown token, where
the expected response is 404. The expected Supabase variable names are present
in `.env.local`, but their values were not inspected. Check the local Next server
output and verify the configured non-production Supabase project has the
`invitations` table/API schema and matching credentials. Rerun
`npm run test:invite`; the unknown-token case must return 404 before this is
closed.

## Incomplete: authenticated dashboard workflows

The audit did not complete dashboard visual/workflow checks. After QA accounts
are available, inspect dashboard, team, opportunity, and settings workflows at
mobile, tablet, and desktop sizes. Add Playwright only if repeatable visual
regression coverage is adopted; it is not required to close the current API or
RLS audit findings.
