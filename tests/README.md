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
- `helpers/trpc.ts` - call tRPC mutations/queries through an authenticated request context.
- `helpers/cleanup.ts` - delete `[E2E]` rows + restore suspended e2e sellers.
- `helpers/locators.ts` - shared `data-testid` locators (`listingRow`/`connectionRow`/`adminRow`/`reviewItem`/`notificationItem`) + temp-account helpers (`createTempUser`/`deleteTempUser`). **Prefer these over CSS-class selectors.**
- `smoke.spec.ts` - shallow "page renders" checks for all buyer/seller/admin routes.
- `auth.spec.ts` - email/password login + logout (runs last).
- `registration.spec.ts` - real signup via `auth.admin.generateLink` (magic link token_hash → /callback → onboarding); email users set a password at onboarding.
- `password-reset.spec.ts` - forgot-password UI + recovery link (`generateLink type recovery`) → reset-password → login with new password.
- `become-seller.spec.ts` - `seller.becomeSeller` (trpc-driven) creates sellers + seller_regions.
- `buyer.spec.ts` - browse, search, wish (+20 limit), bookmark, follow, review, review-like (DB-backed counts).
- `seller.spec.ts` - dashboard, listing lifecycle (table + dropdown actions), connection form.
- `seller-create.spec.ts` - full new-listing single-form flow.
- `cross-role.spec.ts` - wish-notify, admin product-removal cascade (+wish cancel +notify), admin-down → republish.
- `admin-suspend.spec.ts` - suspend seller cascade (listings down / connections ended / notify).
- `admin-{listings,connections,reports}.spec.ts` + `report-takedown.spec.ts` - admin moderation.
- `analytics.spec.ts` - view-count dedup (product/listing/connection views).
- `threads-verification.spec.ts` / `ig-verification.spec.ts` - social verification at `/admin/social-verification` (Instagram/Threads tabs).
- `messages.spec.ts` - buyer↔seller messaging incl. realtime broadcast + 詢問 context journey.
- `wishes.spec.ts` - public wish board + wish detail.
- `banner.spec.ts` - homepage hero banner.
- `cron-expire.spec.ts` - `/api/cron/expire-daily` expiry (needs `CRON_SECRET`, else skipped).
- `seo.spec.ts` / `storage.spec.ts` / `orphan-images.unit.spec.ts` - SEO, orphan-image cleanup.
- `manual/*.mjs` - standalone Node API smoke/debug scripts (unchanged).

> Schema 真實來源是實際 DB（用 Supabase MCP 查），**不是** `server/db/types.ts`（手寫已過時）。
> 註冊/重設密碼用 `generateLink` 模擬點信，不靠真實信箱；become-seller / 註冊用臨時帳號（`e2e-tmp-*`，測後刪除）。

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
