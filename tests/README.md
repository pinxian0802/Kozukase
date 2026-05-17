# Tests

Playwright end-to-end suite plus a small set of manual API scripts.

## Dedicated E2E accounts

Three role-isolated accounts (all password in `E2E_PASSWORD`):

| Role  | Env var            | Account                   | Notes                              |
|-------|--------------------|---------------------------|------------------------------------|
| Buyer | `E2E_BUYER_EMAIL`  | `e2e-buyer@kozukase.test` | plain buyer, not seller/admin      |
| Seller| `E2E_SELLER_EMAIL` | `e2e-seller@kozukase.test`| seller, region 日本                |
| Admin | `E2E_ADMIN_EMAIL`  | `e2e-admin@kozukase.test` | `app_metadata.role=admin`          |

These vars plus `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` live in
`.env.local` (gitignored) and are loaded into `process.env` by `playwright.config.ts`.

## Structure

- `setup/{buyer,seller,admin}.setup.ts` - log each account in, persist `tests/.auth/<role>.json`.
- `global.teardown.ts` - after every run: restore global state + purge all `[E2E]`-prefixed data.
- `fixtures.ts` - `buyerPage` / `sellerPage` / `adminPage` fixtures for cross-role specs.
- `helpers/naming.ts` - `e2eName()` produces unique `[E2E]`-prefixed names.
- `helpers/db.ts` - service-role client, DB-side assertions, and data seeding.
- `helpers/cleanup.ts` - delete `[E2E]` rows + restore suspended e2e sellers.
- `auth.spec.ts` - auth/login/logout flows.
- `buyer.spec.ts` - browse, search, wish, bookmark, follow, review (DB-backed counts).
- `seller.spec.ts` - dashboard, listing lifecycle, connection form.
- `cross-role.spec.ts` - wish-notify, admin product removal cascade, admin-down → republish.
- `messages.spec.ts` - buyer↔seller messaging basic flow.
- `manual/*.mjs` - standalone Node API smoke/debug scripts (unchanged).

## Data hygiene

Tests run against the shared Supabase project, so all created data is named with the
`[E2E]` prefix. Each spec cleans its own data; `global.teardown.ts` is the final
safety net that sweeps any remaining `[E2E]%` rows.

## How to run

- Full suite: `npm test`
- Single project: `npx playwright test --project=buyer` (or `auth`/`seller`/`cross-role`)
- Manual API smoke test: `node tests/manual/listing-flow.mjs`

## Notes

- `workers: 1` — tests are serialized to avoid interfering on the shared DB.
- Keep `playwright-report/` and `test-results/` out of version control unless debugging.
