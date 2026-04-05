# Tenant Isolation Test Checklist

Use this checklist to verify org/factory isolation before go-live.

## Preconditions
1. Create two orgs (Org A, Org B).
2. Create two factories per org (Factory A1, A2, B1, B2).
3. Create users with distinct roles in each org/factory.

## API Checks (Manual)
1. Login as Org A user (Token A).
2. Attempt to access Org B data:
   - `GET /entries/` with Org B entry IDs should return 404.
   - `GET /reports/pdf/{entry_id}` with Org B entry ID should return 404 or 403.
   - `GET /analytics/weekly` should only show Org A data.
3. Switch to Org B user (Token B) and repeat.

## Factory Scope Checks
1. For a Manager tied to Factory A1:
   - List users and entries: must only show Factory A1 data.
2. For Supervisor role:
   - Entries should only include their own submissions.

## Negative Tests
1. Try to update/delete resources from another org/factory:
   - Expect 403/404.
2. Try to access `select-factory` with a factory not in the user’s list:
   - Expect 403/404.

## Audit Logs
1. Ensure unauthorized attempts are logged (if logging enabled).

## Sign-off
- [ ] Org-level data isolation verified
- [ ] Factory-level data isolation verified
- [ ] Role-based access verified
