# Tests

This folder contains both Playwright end-to-end tests and a small set of manual API scripts.

## Structure

- `auth.spec.ts` - Playwright auth flow checks.
- `listing.spec.ts` - Playwright coverage for listing creation and management.
- `product.spec.ts` - Playwright coverage for product-related flows.
- `seller.spec.ts` - Playwright coverage for seller pages and seller state.
- `global.setup.ts` - Playwright setup that prepares the logged-in storage state.
- `.auth/user.json` - Generated storage state used by Playwright. This file is produced by setup and should be treated as generated output.
- `manual/listing-flow.mjs` - Plain Node.js smoke test for the full product + listing API flow.
- `manual/debug-auth.mjs` - Small helper script for checking Supabase auth cookie/session details.

## How to run

- Playwright suite: `npm test`
- Manual API smoke test: `node tests/manual/listing-flow.mjs`
- Manual auth debug helper: `node tests/manual/debug-auth.mjs`

## Notes

- Playwright is configured to use `tests/.auth/user.json` as its storage state.
- The manual API script logs in with the test account, then talks directly to the tRPC API using the Supabase SSR auth cookie.
- Keep generated browser artifacts such as `playwright-report/` and `test-results/` out of version control unless you are debugging a failure.
