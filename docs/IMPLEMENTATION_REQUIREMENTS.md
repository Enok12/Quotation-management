# MONTRA: Implementation Requirements

Source: Business Analyst review + Senior Engineer code review (2026-10-27).
Audience: developers implementing the work. Each item has an ID, scope, files, and acceptance criteria (AC).

## How to use this document

- Work in the order of the **Delivery Plan** (section 5). Phase 0 items block everything that touches money or permissions.
- Engineering findings were produced by reading the code only. Nothing was run. Items marked **(verify)** must be reproduced before fixing.
- Paths are relative to `app-scaffold/`. Line numbers were correct at review time and may drift; search by symbol if they do.
- Tenant isolation rule for all new code: every query and mutation is scoped by `businessId`, and any client-supplied foreign id is re-checked against the tenant.
- Money rule for all new code: use `Prisma.Decimal` (or integer minor units), never JS floats. Validate with a shared zod `money` schema.
- Every new mutation writes an `AuditLog` row inside the same transaction.
- Effort: S = under 1 day, M = 1 to 3 days, L = more than 3 days.

---

## 1. Context (current system)

- Stack: Next.js 15 (App Router), React 19, Prisma 6 + PostgreSQL (Neon), Clerk auth, Tailwind, pdf-lib, Vercel Blob, Resend email, Gemini (receipt OCR), hosted on Vercel (region `sin1`).
- Multi-tenant: `Business` is the tenant. Roles per membership: `ADMIN`, `STAFF`, `PATTERN_MAKER`. Plans gate dashboard sections via `Plan.enabledSections` (`src/lib/section-access.ts`).
- Layering: route handler (`src/app/api/v1/**`) -> service (`src/server/services/**`) -> repository (`src/server/repositories/**`) -> Prisma. Responses use the envelope in `src/lib/api/response.ts` (`handler`, `ok`).
- Not present today: tests, lint, CI, error monitoring, rate limiting, cron jobs, payment gateway, CSV export, order due dates, customer measurements, suppliers.

---

## 2. Phase 0: Security and correctness fixes (do first)

### SEC-1. Unified route guard for auth, membership, section and role [Critical, M]

**Problem.** `requireBusiness()` (`src/lib/auth.ts`) returns the role but never checks it. Only 24 of 45 routes call `requireSection`. Role confinement (`ROLE_SECTIONS` in `section-access.ts`) and subscription status (`inGoodStanding`) are enforced only in page layouts, so direct API calls bypass them.

Routes with no section or role check (verify the full list with a grep for routes lacking a guard):
`customers/route.ts`, `customers/[id]/route.ts` (GET, PUT), `customers/[id]/incomplete-samples`, `receipts/route.ts`, `receipts/[id]/route.ts`, `receipts/[id]/payments`, `receipts/[id]/items`, `receipts/[id]/versions`, `receipts/[id]/convert`, `receipts/[id]/generate-pdf`, `receipts/extract`, `orders/[id]/status`, `receipt-items/[id]/status`, `dashboard/stats`, `customer-invites`.

**Requirements.**
1. Add one helper, e.g. `requireBusiness({ section, roles?, write? })`, that does auth, membership, `getBusinessAccess`, section check, optional role check, and subscription check, and returns `{ businessId, userId, role }`.
2. Replace all `requireBusiness()` + `requireSection()` pairs in routes with the helper. A route must not be able to skip the check by omission: make `section` a required argument.
3. Decide and document behaviour for `EXPIRED` / `CANCELLED` tenants: recommended read-only for GET, 403 with a clear message for mutations.
4. Unauthenticated requests return 401 (currently 403 at `auth.ts:43`). Authenticated but forbidden returns 403.

**AC.**
- A `PATTERN_MAKER` receives 403 from every receipt, customer, payment and expense route.
- A tenant with `EXPIRED` status cannot mutate through the API.
- A test enumerates every `src/app/api/**/route.ts` and fails if one does not call the guard (public routes are listed in an explicit allowlist).

### SEC-2. Race-safe payments and receipt numbering [Critical, M]

**Problem.** `receiptService.recordPayment` (`src/server/services/receipt.service.ts` ~L325-370) reads the receipt outside the transaction, computes `amountPaid`, `balance`, `paymentStatus` and `nowConfirms` from the stale copy, then writes absolute values. Concurrent requests lose a payment from `amountPaid` and can each call `nextReceiptNumber` (burning a number and overwriting `trackingToken`). `update()` (~L132) and `changeItemStatus` (~L263) use the same stale-read pattern. Amount has no upper bound (`payments/route.ts:10`).

**Requirements.**
1. Perform the read inside `prisma.$transaction`, with a row lock (`SELECT ... FOR UPDATE` through `$queryRaw`) or a conditional `updateMany` plus a count check.
2. Derive `amountPaid` from `SUM(payments.amount)` or use `{ increment }`. Do not write a computed absolute value from a stale read.
3. Re-check `receiptNumber IS NULL` inside the transaction before calling `nextReceiptNumber`. Set `trackingToken` only if currently null.
4. Reject an amount greater than the outstanding balance (or require an explicit overpayment flag).
5. Accept an `Idempotency-Key` header on `POST /receipts/[id]/payments`. A repeated key returns the original result and creates no second row.
6. Apply the same locking approach to `update()` and `changeItemStatus`.

**AC.**
- An integration test fires 10 concurrent payments at one receipt and the ledger sum equals `amountPaid`.
- A test fires 2 concurrent first payments at an unconfirmed receipt: exactly one receipt number is consumed and the sequence has no gap.
- A repeated idempotency key creates one Payment row.

### SEC-3. Rate limiting and abuse protection on public endpoints [Critical, M]

**Problem.** There is no rate limiting. `GET/POST /api/v1/track` (`track/route.ts`) matches on invoice number + last 4 phone digits (about 10k guesses) across all tenants (`findMany` where `receiptNumber`, `orderType: BULK`) and returns the first phone match, so tenants can see each other's orders. `customers/public/route.ts` is unauthenticated, the invite token is reusable and never expires (`customer-invites/route.ts:21`), and each submission creates a customer and sends an awaited email. `api/public/receipt-pdf` renders a PDF per request with no throttle.

**Requirements.**
1. Add rate limiting (e.g. `@upstash/ratelimit`, or Vercel WAF rules) keyed by IP plus token or invoice number, on: `/api/v1/track`, `/api/v1/customers/public`, `/api/public/receipt-pdf`, `/api/v1/receipts/extract`, `/api/v1/business/register`.
2. `/track`: make the 256-bit `trackingToken` link the primary path. For the number + phone path, either require the full phone number or scope by a business identifier (slug). If more than one tenant matches, return a generic "not found" message and never pick one.
3. Public customer form: add a captcha (Turnstile or hCaptcha), expiry on invite links (default, e.g., 7 days, and tenant can rotate), and dedupe by phone within the tenant.
4. Debounce the notification email (e.g. at most N per business per hour) and do not block the response on it.

**AC.**
- The 11th request in the limit window returns 429 with `Retry-After`.
- Two tenants with the same invoice number and phone suffix never see each other's data.
- A submission without a valid captcha token is rejected.

### SEC-4. Restrict destructive operations and add soft delete [High, M]

**Problem.** `DELETE /receipts/[id]` and `PUT /receipts/[id]` use only `requireBusiness` (`receipts/[id]/route.ts:16-30`), so any member can hard-delete a receipt with its payments, or edit `amountPaid`, `advanceAmount` and items of a finalized receipt. The README and `receipt.service.ts:125` claim admin-only, but the route does not enforce it. `customerService.remove` (`customer.service.ts:60-81`) hard-deletes a customer and all receipts, payments and ledgers. Expense `profit` is trusted from the client (`expense.service.ts:216`).

**Requirements.**
1. Receipt delete and finalized-receipt edit: `ADMIN` only (via the SEC-1 helper's `roles`).
2. Add `deletedAt DateTime?` to `Receipt` and `Customer` (migration). Repositories filter `deletedAt: null` by default. Delete becomes a soft delete with an audit row.
3. Block deleting a receipt that has Payment rows, or require a void-with-reason flow.
4. Compute expense `profit` server-side. If a manual override is kept, store it in a separate column and audit it.

**AC.**
- STAFF gets 403 on receipt delete and finalized edit.
- A deleted customer's receipts and payments still exist and are excluded from lists; an admin can restore.
- Profit shown on Income matches the server calculation unless an audited override exists.

### SEC-5. Verified-email check when linking Clerk users [High, S] (verify)

**Problem.** `src/lib/auth.ts:58-62` finds an existing local user by `primaryEmailAddress.emailAddress` and overwrites its `clerkId` if different. It does not check that the address is verified. If the Clerk instance allows unverified emails or untrusted providers, this is an account-takeover path.

**Requirements.**
1. Relink only when `primaryEmailAddress.verification?.status === "verified"`.
2. Preferably move relinking into a one-off migration script and remove it from the request path.
3. Add a Clerk webhook (`user.updated`, `user.deleted`) to keep the local `User` in sync (placeholder `@pending.local` emails are never corrected today).

**AC.** An unverified email never causes `clerkId` to be overwritten. Webhook payloads are signature-verified.

### SEC-6. PDF link expiry and separate secret [Medium, S]

**Problem.** `src/lib/utils/receipt-pdf-token.ts` signs only the receipt id, with `SECRET_ENCRYPTION_KEY` (the same key that encrypts Gemini keys). Links never expire and cannot be revoked except by deleting the receipt or rotating the key (which destroys stored Gemini keys). The HMAC path does not check key length.

**Requirements.**
1. New env var `PDF_LINK_SECRET`, validated at boot.
2. Sign `id.exp` with a TTL (e.g. 30 days). Optional `pdfLinkVersion Int` on `Receipt` so staff can revoke.
3. Update `SendWhatsappButton` and `/api/public/receipt-pdf` accordingly.

**AC.** An expired or revoked link returns 410/404. Rotating the PDF secret does not affect Gemini keys.

### SEC-7. Non-ASCII filenames in Content-Disposition [Medium, S] (verify)

**Problem.** `generate-pdf/route.ts:38` and `api/public/receipt-pdf/route.ts:39` put the customer name in `filename="..."`. `sanitizeForFilename` (`receipt-filename.ts`) keeps Sinhala characters. Header values must be Latin-1, so a Sinhala name likely throws.

**Requirements.** Emit `filename="<ascii fallback>"; filename*=UTF-8''<percent-encoded>`. Add a unit test with a Sinhala customer name.

**AC.** PDF download and the WhatsApp link both work for a customer named in Sinhala.

### SEC-8. Stock and sales race conditions [High, S to M]

**Problem.** `saleService.create` checks stock outside the transaction (`sale.service.ts:21-36`) then decrements without a guard (L67). `adjustStock` (`inventory.service.ts:288-294`) is the same. `returnService.create` computes returnable quantity outside the transaction (`return.service.ts:107-118`). `refundAmount` is uncapped (`return.schema.ts:26`).

**Requirements.**
1. Use `updateMany({ where: { id, businessId, quantityOnHand: { gte: n } } })` and require `count === 1`, else a 409 "insufficient stock".
2. Recompute returnable quantity inside the transaction under a lock.
3. Cap `refundAmount` at `unitPrice * quantity` of the returned lines.
4. Migration: `CHECK (quantity_on_hand >= 0)` on `InventoryProduct`.

**AC.** 20 concurrent sales of the last 5 units never push `quantityOnHand` below 0. Concurrent returns never exceed the sold quantity.

### SEC-9. Team member management [High, M]

**Problem.** There is no API or UI to remove a member, change a role, or leave a business. `staffInviteService.redeem` (`staff-invite.service.ts:85-89`) upserts the role, so an ADMIN redeeming a STAFF invite is demoted, potentially removing the last admin. Admin invites are bearer-only. The join page shows PATTERN_MAKER as "Staff" (`join/[token]/page.tsx:43`).

**Requirements.**
1. `PATCH` and `DELETE` on `/api/v1/team/members/[id]` (admin only), with audit entries.
2. "Last admin" guard: refuse to remove or demote the only ADMIN.
3. Redeem must `create` only. If the user is already a member, refuse with a clear message.
4. Optional: bind an invite to an email address.
5. Show the correct role label on the join page.

**AC.** A removed member loses access on their next request. The last admin cannot be removed or demoted. Redeeming never changes an existing membership's role.

---

## 3. Phase 1: Data integrity and operations

### DATA-1. Make the Payment ledger the single source of money [High, L]

**Problem.** `receiptService.create` and `update` set `amountPaid` straight from client input without creating Payment rows (`receipt.service.ts:84, 228`); `payments/page.tsx:33-35` acknowledges receipts that have money but no Payment rows. Calculations use floats (`receipt-calc.ts`, `sale.service.ts:41-43`, `receipt.service.ts:333`). Zod allows unbounded, sub-cent values (`receipt.schema.ts:170-175`); a value over 10^10 overflows `Decimal(12,2)` and returns 500.

**Requirements.**
1. Creating or editing a receipt with a paid amount inserts Payment rows. `amountPaid` is derived, never client-settable.
2. Rewrite `receipt-calc.ts` and sale and return math with `Prisma.Decimal`. Share the calculation between client and server (the browser currently duplicates it in `receipt-builder.tsx:68-79`).
3. Add `src/lib/validation/money.ts`: `.finite().multipleOf(0.01).nonnegative().max(9_999_999_999.99)`. Use it in every money field.
4. One-off reconciliation script: report receipts where `SUM(payments) != amountPaid`, with a dry-run mode and an option to create correcting Payment rows.

**AC.** A reconciliation query returns zero mismatches after the script. No money field accepts more than 2 decimal places or overflow values.

### DATA-2. Indexes, constraints and tenancy columns [Medium, M]

**Requirements.**
1. Add composite indexes: `Receipt(businessId, createdAt)`, `Receipt(businessId, orderType, paymentStatus)`, `Receipt(businessId, orderStatus)`. Remove low-value single-column indexes (`status`, `orderType`, `paymentStatus`, `orderStatus`) once replaced.
2. Enable `pg_trgm` and add GIN indexes for the `ILIKE '%x%'` searches (customer name, phone, email; receipt `custName`).
3. Denormalise `businessId` onto `Payment`, `ReceiptItem` and `ExpenseRecord`, with composite foreign keys where practical. Backfill in the migration.
4. Add a `(businessId, phone)` uniqueness or dedupe policy for `Customer` (decide with the product owner, as duplicates may be intentional).
5. Declare `onDelete` behaviour for `Receipt.customerId`.
6. Retention: define a policy for `AuditLog` and `ReceiptVersion.snapshot` (slimmer snapshot, archive after N months).
7. Replace the hard-coded plan id `"plan_full_access_default"` (`business.service.ts:9`) with a name lookup or seed script.

**AC.** `EXPLAIN` on the receipts list and search queries shows index use. Migrations apply cleanly with `prisma migrate deploy` on a copy of production data.

### DATA-3. Tenant check on inventory category [Medium, S]

**Problem.** `categoryId` from the client is written without verification (`inventory.service.ts:46, 91`; `inventory.schema.ts:36`) and `inventory/products/route.ts:14` returns `category.name`, which can leak another tenant's category name.

**Requirements.** Look up the category with `{ id, businessId }` before create and update; 404 otherwise. Prefer a composite FK `(businessId, categoryId)`.

**AC.** Supplying another tenant's category id returns 404.

### API-1. Input validation and error mapping [Medium, S]

**Problem.** `receipts/route.ts:13-19` casts query strings into Prisma enums, and `Number("abc")` gives NaN for `page`; `orders/page.tsx:20-22` and `payments/page.tsx` do the same. `dateRangeFilter` (`src/lib/utils/date-range.ts`) builds Invalid Dates and uses server-local time (UTC on Vercel), so Sri Lanka day boundaries are off by 5.5 hours. Super-admin routes return 500 for unknown ids (P2025) and duplicate plan names (P2002). The `handler` wrapper maps any non-`AppError` to 500.

**Requirements.**
1. Query-string schemas with `z.enum` and `z.coerce` for every list route and page-level `searchParams`.
2. Parse dates strictly, in an explicit `Asia/Colombo` time zone (configurable per business later).
3. Map Prisma errors centrally in `handler`: P2002 -> 409, P2025 -> 404, validation -> 400.
4. Add an audit entry for plan edits (`super-admin/plans/[id]/route.ts:23`).

**AC.** Invalid query input returns 400, never 500. A date filter for "today" covers 00:00 to 23:59 Colombo time.

### UPL-1. Upload hardening [Medium, S to M]

**Problem.** Logo uploads check only `file.type` (`logo-upload-limits.ts:8`). Pattern pictures accept any `image/*`, including SVG (`pattern-upload-limits.ts:10`). Blobs are `access: "public"`. In `patterns/route.ts:63-71` the blob is uploaded before `patternService.create`, so a duplicate code (409) orphans the blob. Size limits are enforced after `formData()` has buffered the body. No per-tenant quota.

**Requirements.**
1. Sniff magic bytes (e.g. `file-type`). Pictures: png, jpeg, webp only (no SVG).
2. Create the DB row first, or `del()` the blob on failure.
3. Move to client-upload tokens (`@vercel/blob/client`) or private blobs with signed URLs for pattern module files.
4. Add a per-business storage quota and record blob size.

**AC.** A renamed non-image file is rejected. A failed pattern create leaves no orphan blob.

### OPS-1. Security headers and outbound request hygiene [Medium, S]

**Requirements.**
1. Add `headers()` in `next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `frame-ancestors`/`X-Frame-Options`, and a CSP (start in report-only).
2. Remove the dev value `serverActions.allowedOrigins: ["localhost:3000"]` for production.
3. Cap businesses a user can register (per user and per hour) in `business/register`.
4. Add `AbortSignal.timeout` to every outbound `fetch` (Gemini key check `gemini-key/route.ts:16`, extract service `receipt-extract.service.ts`). Do not put the Gemini key in a URL query string if a header option exists. Normalise upstream errors instead of returning Google's raw message (`receipt-extract.service.ts:351`).
5. Make the Gemini prompt tenant-neutral (`receipt-extract.service.ts:289` hard-codes "MONTRA").

### PERF-1. Pagination, caching and aggregates [Medium, M]

**Problem.** No pagination on `saleService.list`, `returnService.list`, `inventoryService.list`, `listAllMovements`, `listMovements`, `patternService.list`, `/inventory/sales` GET. Only 10 of 37 `findMany` calls use `take`. `income/page.tsx:41` loads every finalized receipt in range. `payments/page.tsx:102-105` loads every tenant receipt for "Sync all". The layout and page each repeat `requireBusiness` + `getBusinessAccess`; `React.cache()` is unused. Finished PDFs are not cached. `next/image` is unused.

**Requirements.**
1. Shared `paginate` helper (page or cursor); apply to every list route listed above.
2. Wrap `requireBusiness` and `getBusinessAccess` in `React.cache()`. Short-TTL cache for plan data.
3. Income totals via `groupBy`/`aggregate` in SQL.
4. Make "Sync all" paginated or on-demand.
5. Cache rendered PDFs in Blob keyed by `receiptId + currentVersion`; cache the logo bytes.
6. Use `next/image` (configure `remotePatterns` for Blob) where images are displayed.

**AC.** No list endpoint returns more than the page size. Income page query count and payload size drop measurably (record before and after).

### QA-1. Tests, CI, observability, env validation [High, M]

**Problem.** `package.json` has no `test`, `lint`, `typecheck` or `format` script. No ESLint, Vitest/Jest, Prettier or Playwright config, no `.github/`, no `.env.example` (README references it), no `vercel.json`, no error monitoring. Logging is `console.error("[unhandled]")` (`response.ts:164`). `process.env` is read ad hoc in 8 places; `SECRET_ENCRYPTION_KEY` is validated only on first use.

**Requirements.**
1. `src/env.ts`: zod schema for all env vars, parsed at boot (fail fast). Commit `.env.example`.
2. Scripts: `typecheck`, `lint`, `test`, `format`. Add ESLint (Next config), Prettier, Vitest.
3. Tests, in priority order: `receipt-calc`, receipt numbering, route-guard inventory (SEC-1), tenant-scoping tests, concurrent payment and stock tests against a throwaway Postgres (service container in CI).
4. GitHub Actions: install, `prisma validate`, typecheck, lint, test, build. Run `prisma migrate deploy` in the deploy step (not in `npm run build`).
5. Sentry (or equivalent) plus structured logging with a request id.
6. Add `error.tsx` and `not-found.tsx` at the app and dashboard levels.

**AC.** CI is green on a clean clone. A deliberately added unguarded route fails CI.

---

## 4. Phase 2: Product features (from the BA review)

Prerequisites: SEC-1, SEC-2, DATA-1 and QA-1 are complete before billing or notification features ship.

### Tier 1: low effort, existing infrastructure

| ID | Feature | Requirements | Notes |
|---|---|---|---|
| F-1 | **Order due/delivery date** | Add `dueDate DateTime?` to `Receipt`. Field on the receipt builder. Overdue and "due this 7 days" filters on Orders/Production. Reminders popup sorts overdue first. | Gate behind the existing sections. Audit changes. |
| F-2 | **Customer measurements** | New `Measurement` model (`businessId`, `customerId`, label, JSON values, `takenAt`, `takenById`) with history. Optional link to `ReceiptItem`. UI on customer detail page. Shown on job sheet. | Tenant-scope everything; no PII in logs. |
| F-3 | **CSV/Excel export** | Export routes for customers, receipts, payments, expenses, income, filtered by the same params as the list views. Stream large results. Respect the section and role guard. | Escape formula-injection characters (`=`, `+`, `-`, `@`) in cells. |
| F-4 | **Production job sheet PDF** | New pdf-lib template (per order or item): customer, due date, items, measurements, pattern code and file link, notes. | Follow `receipt-template.ts` structure; reuse Sinhala font support. |
| F-5 | **Dashboard KPIs** | Revenue, outstanding balance, orders by stage, overdue count, top customers; date-range filter. Replace the 2-count `dashboard/stats`, and remove the duplicate `getStats` in `dashboard/page.tsx`. | SQL aggregates, cached per request. |
| F-6 | **Customer notifications on stage change** | On `OrderStatusHistory` write, send an email (and a prefilled WhatsApp link in UI) with the tracking link. Per-business opt-in setting. | Use the outbox from F-8; never block the status change. |

### Tier 2: needs new infrastructure

| ID | Feature | Requirements |
|---|---|---|
| F-7 | **Scheduled jobs** | Vercel Cron routes (secured with `CRON_SECRET`): subscription expiry (reads `subscriptionRenewsAt`), daily payment reminders, overdue alerts. Idempotent. |
| F-8 | **Outbox for email/WhatsApp/SMS** | `OutboundMessage` table (status, attempts, nextAttemptAt, payload). Worker route processes with retries and backoff. Replace fire-and-forget email in `server/email/notify.ts`. |
| F-9 | **WhatsApp Business API or SMS gateway** | Provider adapter behind an interface; templates for receipt, reminder, stage change. Webhook with signature verification. |
| F-10 | **Online payments** | PayHere (or similar) payment link on receipt and tracking page; webhook creates a Payment row through the SEC-2 path (idempotent). |
| F-11 | **Real billing and plan limits** | `Plan.limits` (seats, receipts per month, storage, AI extractions); usage counters; enforce in services; billing webhook sets `SubscriptionStatus`. New tenants default to `TRIAL` with an end date. |
| F-12 | **Supplier and purchase tracking** | `Supplier`, `PurchaseOrder`; link purchases to orders to feed `ExpenseRecord.fabricExpense`; reuse the inventory movement ledger. |
| F-13 | **Worker assignment and piece-rate payroll** | Assignee on `ReceiptItem`/stage; payout model; period report. |
| F-14 | **Customer portal** | Magic-link access to order history and payment; builds on the tracking-token approach. |

### Tier 3 (longer term, scope separately)
Wholesale fabric stock with low-stock alerts; combined wholesale + retail P&L; quotation-to-order flow with customer approval link; stage-delay analytics; multi-branch; PWA with offline measurement entry; Sinhala/Tamil UI; feedback and loyalty; public signup page.

### Recommendations module (decision needed)
`src/server/recommendations/*`, `src/lib/recommendations/terms.ts`, the `Recommendation` and `TrendSnapshot` models, and the `RECOMMENDATIONS` section exist, but no page or route uses them, and the nav entry `/dashboard/recommendations` (`dashboard/layout.tsx:42`) is a 404. Product owner to choose: **finish** (page + Gemini generation + SerpApi cache) or **remove** (code, models via migration, section enum value, nav item, `SERPAPI_KEY`).

---

## 4A. RET-COD: Cash on Delivery for the Retail section only

Scope: the Retail group only (Sales, Returns, Inventory; `Section.SALES` and `Section.INVENTORY`). Wholesale receipts, orders and the `Payment` ledger are **out of scope** and must not change.

### Current retail behaviour that shapes the design (verified in code)

- `saleService.create` (`src/server/services/sale.service.ts`) records a sale as **already complete**: it creates `InventorySale` + `InventorySaleItem`, writes an `OUT` stock movement and decrements `quantityOnHand` in one transaction.
- `InventorySale` has **no customer, no address, no phone and no status**. `paymentMethod` is optional and limited to `CASH | CARD | BANK_TRANSFER | OTHER` (`sale.schema.ts`).
- `src/app/dashboard/retail/sales/page.tsx` sums **every** sale as revenue and profit (profit = `(unitPrice - costPriceAtSale) * quantity`). A pending or refused COD sale would be counted as revenue unless this changes.
- `returnService.create` always restocks **and** refunds (`refundAmount` defaults to `unitPrice * quantity`). It models a customer returning goods after paying. It does not model a parcel refused at the door where no money was collected.
- Retail uses floats for money (`sale.service.ts:41-43`) and has the stock race described in SEC-8.

### Implementation status (branch `feature/retail-cod`, 2026-10-27)

Built: schema + migration `prisma/migrations/20261027120000_retail_cod/migration.sql` (**not yet applied to any database**: run `npx prisma migrate deploy` before starting the app, or every dashboard page fails on the new `Business` columns); `src/server/services/cod.service.ts` (create, transitions, list, summary, refusal check, settlement, public confirm); API routes under `/api/v1/inventory/cod/*`, `/api/v1/inventory/sales/[id]/cod`, `/api/v1/inventory/sales/[id]/dispatch-sheet`, `/api/v1/cod/confirm/[token]`, `/api/v1/business/cod-settings`; Record Sale dialog with COD mode, refuser warning and WhatsApp link; COD Orders page (`/dashboard/retail/cod`); customer page `/cod-confirm/[token]`; dispatch sheet PDF; Settings toggle; revenue recognition on the Sales page; COD receivable card; returns blocked on non-delivered COD orders.

Deliberate differences from the spec text below: the delivery row also has a `closedAt` timestamp (set on REFUSED/CANCELLED, used for "last refused on"); status changes use one endpoint `PATCH /inventory/sales/[id]/cod` with an `action` field instead of separate routes; the COD list is tab-based (Open, Awaiting confirmation, Ready to dispatch, Out for delivery, Awaiting courier payout, Settled, Refused/cancelled).

Retail-only plans: the COD on/off switch is not only in Settings. `PUT /api/v1/business/cod-settings` is gated on the `SALES` section (admin only), and the same form appears on the Sales page (while COD is off) and in a "COD settings" panel on the COD Orders page, so a plan without the Settings section can still enable COD.

Test data: `node scripts/seed-cod-test-data.js --business "<name>" [--count N] [--enable-cod]` creates fake COD orders (all statuses, settlements, repeat refusers, aged payouts) tagged for removal; `--clean` removes only what it created. Stock stays consistent with the order statuses.

Not built yet: paste-chat-to-draft (Gemini); automatic release of unconfirmed orders; tests (the project has no test runner, so the COD logic was checked with typecheck, a production build, and ad-hoc scripts for phone normalisation, validation schemas and PDF generation; the transactional paths have **not** been run against a database).

### Sequencing decision (2026-10-27): COD is built FIRST

The product owner wants RET-COD (with the Level 1 WhatsApp-assisted flow, RET-WA-1 below) implemented before any other enhancement. This overrides the earlier "do not start before SEC-1/SEC-8/DATA-1" ordering. Consequence: **the COD code must carry its own safeguards** and must not depend on those fixes being done. Specifically, all NEW COD code paths must be tenant-scoped, race-safe (conditional updates inside one transaction), use `Prisma.Decimal`, and be role-checked in the route itself. The existing in-store `saleService.create` and `returnService.create` stay as they are; COD does not rely on them. The remaining SEC/DATA items stay in the backlog and still apply to the rest of the system.

### Safeguards COD must implement itself (formerly "prerequisites")

- **SEC-8** (stock/sales/returns race safety). COD adds more stock transitions (reserve, restock on refusal), so the existing check-then-act pattern would oversell and double-restock.
- **SEC-1** (route guard) for all new routes.
- **DATA-1 (Decimal part)**: new COD money fields use `Prisma.Decimal` and the shared `money` zod schema.

### Business model (rules confirmed by the product owner; see "Decisions" at the end of this section)

1. A retail sale can be **In-store** (existing behaviour, unchanged) or **COD delivery**.
2. **Stock is reserved when the COD sale is created** (decrement `quantityOnHand`, `OUT` movement with reason `"Sold (COD)"`). This prevents overselling. If the parcel is refused or cancelled, stock is restored with an `IN` movement (reason `"COD refused"` or `"COD cancelled"`).
3. **Revenue and profit are recognised when the courier confirms delivery and collection**, not at order creation. Pending, out-for-delivery, refused and cancelled COD sales are **excluded** from Revenue and Profit.
4. **Cash is recognised only when the courier remits**. Between "collected by courier" and "remitted" the amount is a **COD receivable**, shown separately.
5. The delivery fee is **entered by the seller per order** (free amount field; no courier rate table, no auto-calculation). Who bears it is a per-order choice `feePaidBy`, defaulting to `CUSTOMER` (added to the COD amount). If `BUSINESS`, the fee reduces profit.
6. A parcel **refused at the door** is not a customer return: no refund, no money was collected. It uses its own path, not `returnService.create`. A **later return of a delivered COD order** uses the existing returns flow unchanged.

### Data model changes (one migration)

Keep `InventorySale` simple and put COD data in a 1:1 child so existing in-store queries are untouched.

```prisma
enum SaleFulfilment { IN_STORE COD_DELIVERY }          // add to InventorySale, default IN_STORE

enum CodStatus {
  PENDING_CONFIRMATION // created, stock reserved, waiting for the customer to confirm via the WhatsApp link (RET-WA-1)
  PENDING_DISPATCH   // confirmed by the customer (or confirmed manually by the seller), ready to hand to the courier
  OUT_FOR_DELIVERY   // handed to courier / rider
  DELIVERED          // courier collected cash (receivable)
  REMITTED           // cash received from courier (settled)
  REFUSED            // customer refused or unreachable; stock restored
  CANCELLED          // cancelled before dispatch; stock restored
}

model InventorySaleDelivery {
  id          String   @id @default(cuid())
  saleId      String   @unique
  sale        InventorySale @relation(fields: [saleId], references: [id], onDelete: Cascade)
  businessId  String                      // denormalised for tenant-safe queries
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  customerName    String
  customerPhone   String
  customerPhone2  String?
  customerPhoneNormalized String          // digits only, +94 form (see lib/customer-match.ts / toWaNumber logic); used for refusal flagging
  deliveryAddress String
  city            String?

  courierName  String?
  waybillNo    String?
  codAmount    Decimal @db.Decimal(12, 2)      // amount the courier must collect
  deliveryFee  Decimal @default(0) @db.Decimal(12, 2)
  feePaidBy    DeliveryFeePayer @default(CUSTOMER)   // enum: CUSTOMER | BUSINESS

  status       CodStatus @default(PENDING_DISPATCH)
  dispatchedAt DateTime?
  deliveredAt  DateTime?
  remittedAt   DateTime?
  closedReason String?                          // refusal / cancel reason

  // Our own per-business reference ("COD-0042"), auto-numbered with an atomic counter
  // (Business.lastDispatchNumber) inside the creation transaction. NOT the courier waybill.
  dispatchRef  String
  // Customer confirmation link (RET-WA-1): 256-bit token, single purpose, expires.
  confirmToken     String?   @unique
  confirmExpiresAt DateTime?
  confirmedAt      DateTime?
  confirmedBy      String?                      // "CUSTOMER" (via link) | "SELLER" (manual)
  @@unique([businessId, dispatchRef])

  settlementId String?
  settlement   CodSettlement? @relation(fields: [settlementId], references: [id], onDelete: SetNull)

  @@unique([businessId, courierName, waybillNo])   // verify null-handling; or enforce in service
  @@index([businessId, status])
  @@index([settlementId])
  @@index([businessId, customerPhoneNormalized, status])   // refusal-count lookup
}

model CodSettlement {                            // one courier remittance covering many orders
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  courierName String
  reference   String?                              // bank / courier statement reference
  receivedAt  DateTime
  grossCollected Decimal @db.Decimal(12, 2)        // sum of codAmount of included orders
  feesDeducted   Decimal @db.Decimal(12, 2)
  netReceived    Decimal @db.Decimal(12, 2)        // what actually arrived
  variance       Decimal @db.Decimal(12, 2)        // gross - fees - net; non-zero = flag
  note        String?
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  deliveries  InventorySaleDelivery[]
  @@index([businessId, receivedAt])
}
```

- Add `AuditAction` values: `COD_SALE_CREATED`, `COD_DISPATCHED`, `COD_DELIVERED`, `COD_REFUSED`, `COD_CANCELLED`, `COD_SETTLED`.
- Do **not** add a new `Section` enum value. COD lives under `SALES` (a new `Section` value forces edits in `SECTION_LABELS`/`SECTION_GROUPS` and plan editor). A per-plan COD toggle can come later with `Plan.limits` (F-11).
- Add `Business.codEnabled Boolean @default(false)` (admin setting) so the COD option only appears for businesses that opt in.
- Add `Business.codRefusalWarnThreshold Int @default(2)` and `Business.lastDispatchNumber Int @default(0)` (atomic counter for `dispatchRef`).
- Status transitions gain `PENDING_CONFIRMATION -> PENDING_DISPATCH` (customer confirms via link, or seller confirms manually) and `PENDING_CONFIRMATION -> CANCELLED` (customer declines, or seller cancels). A seller who already has the details from the chat may create the sale directly in `PENDING_DISPATCH`.
- **Unconfirmed orders and stock.** Stock is reserved at creation. There is no cron yet, so there is **no automatic release**: the COD list shows the age of every `PENDING_CONFIRMATION` order and flags those past their link expiry; the seller cancels them manually, which restores stock. (Automatic release can follow with F-7.)

### API (all under `/api/v1/inventory/...`, guarded with SEC-1 helper, section `SALES`)

| Method | Path | Purpose | Role |
|---|---|---|---|
| POST | `/inventory/sales` (extend) | Accepts `fulfilment: "COD_DELIVERY"` + delivery block; creates sale, reserves stock, creates `InventorySaleDelivery` in `PENDING_DISPATCH` in one transaction | ADMIN, STAFF |
| PATCH | `/inventory/sales/[id]/cod` | Status transitions: dispatch (set courier/waybill/fee), mark delivered, mark refused, cancel. Enforces the allowed transition table below | ADMIN, STAFF |
| GET | `/inventory/cod` | Paginated list with filters: status, courier, date range, search by phone/waybill | ADMIN, STAFF |
| POST | `/inventory/cod/settlements` | Create a settlement from selected `DELIVERED` orders; computes gross, fees, variance; sets orders to `REMITTED` | **ADMIN only** |
| GET | `/inventory/cod/summary` | Counts and amounts per status, receivable by courier and age (0-7, 8-14, 15+ days), refusal rate | ADMIN, STAFF |
| GET | `/inventory/cod/refusal-check?phone=` | Returns the number of `REFUSED` COD orders for that normalised phone within the tenant, plus the last refusal date. Used by the Record Sale dialog to show a warning | ADMIN, STAFF |

Allowed transitions (anything else returns 409):
`PENDING_DISPATCH -> OUT_FOR_DELIVERY | CANCELLED`, `OUT_FOR_DELIVERY -> DELIVERED | REFUSED`, `DELIVERED -> REMITTED` (settlement only), `REFUSED`/`CANCELLED`/`REMITTED` are terminal.

Rules for the services (`sale.service.ts`, new `cod.service.ts`):
1. Every transition runs in `$transaction`, reads the row inside the transaction, and uses a conditional update (`where: { id, status: <expected> }`, require `count === 1`) so double-clicks and concurrent updates cannot apply twice.
2. `REFUSED` / `CANCELLED` restore stock exactly once, with a stock movement per line and the reason string, and audit rows. They must **not** create an `InventoryReturn` and must not refund.
3. `DELIVERED` freezes `deliveredAt`; revenue and profit queries include a COD sale only when `status IN (DELIVERED, REMITTED)`.
4. `codAmount` is computed server-side: `totalAmount + (feePaidBy = CUSTOMER ? deliveryFee : 0)`. It is never trusted from the client.
5. Settlement: all selected orders must belong to the tenant, be `DELIVERED`, and share the courier. `variance = grossCollected - feesDeducted - netReceived`. A non-zero variance is saved and highlighted, never silently absorbed.
6. Writing profit: reported profit for COD sales subtracts `deliveryFee` when `feePaidBy = BUSINESS`.
7. `ReturnCreate` on a COD sale is allowed only when its `status` is `DELIVERED` or `REMITTED`.

### UI

- **Record Sale dialog** (`src/components/sales/record-sale-button.tsx`): add a "Fulfilment" choice (In-store / COD delivery). COD shows name, phone (reuse `phone-input.tsx`), address, city, courier (optional), delivery fee, fee paid by. Show the COD amount to be collected.
- **Sales page**: add a Fulfilment/COD status column and a filter. The summary cards must exclude non-recognised COD sales. Add a card "COD receivable" (sum of `DELIVERED` not yet remitted).
- **New page** `src/app/dashboard/retail/cod/page.tsx` (add to the Retail nav, gated by `SALES`): tabs for Pending dispatch, Out for delivery, Awaiting remittance, Settled, Refused/Cancelled. Row actions follow the transition table. "Create settlement" action for admins on the Awaiting remittance tab.
- **Waybill / dispatch sheet PDF** (follow `src/server/pdf/receipt-template.ts` structure): customer, address, phone, items, **amount to collect**, waybill number. Must render Sinhala text (see SEC-7 for the filename header).
- **Settings**: a toggle for `codEnabled` and a numeric `codRefusalWarnThreshold` (default 2; admin editable).
- **Couriers are free text.** The courier is not known yet, so there is no courier table or fixed list. `courierName` is **required when dispatching** (an own rider can be entered as a name too) and is offered as autocomplete from previously used names in the tenant. Settlement groups orders by this name. Do not hard-code any courier's fee structure, API or settlement cycle.
- **Refusing-customer flag (warning only, never blocks the sale).** In the Record Sale dialog, when a COD phone number is entered, call `/inventory/cod/refusal-check`. If the count is at or above `codRefusalWarnThreshold`, show a prominent warning ("This number refused N earlier COD orders, last on <date>") and let the seller continue. Also show a "Frequent refuser" badge on the COD list rows for such numbers. Scope is strictly per business: never share refusal data across tenants.

### Reporting requirements

- COD receivable by courier and age bucket.
- Refusal rate and loss (cost of refused parcels, delivery fees paid on refused parcels) per courier and per period.
- Average days from `deliveredAt` to `remittedAt` per courier.
- Settlement variance history.

### Acceptance criteria

- Creating a COD sale reserves stock and creates a delivery row in `PENDING_DISPATCH`, atomically. If any line lacks stock the whole sale fails with 409.
- 20 concurrent COD sales for the last 5 units never push `quantityOnHand` below 0.
- Marking `REFUSED` twice restores stock once and returns 409 the second time.
- Refused and cancelled COD sales never appear in Revenue, Profit or Returns.
- Revenue and profit on the Sales page include a COD sale only after `DELIVERED`.
- A settlement with `netReceived` different from `gross - fees` records the variance and flags it in the UI.
- STAFF cannot create settlements; a `PATTERN_MAKER` gets 403 on every COD route.
- Tenant A cannot read, transition or settle tenant B's COD orders (test with a foreign id on every route).
- A delivered COD sale can be returned through the existing returns flow, with the normal refund and restock.
- Existing in-store sales behave exactly as before (regression test).
- Entering a phone number with 2 or more earlier `REFUSED` orders in the same tenant shows the refuser warning; the number written as `0771234567`, `+94771234567` and `94 77 123 4567` all match the same customer. The sale can still be saved.
- A refusal count from tenant A never appears for tenant B.
- Dispatching without a `courierName` returns 400. Settlement for orders with different courier names returns 400.
- The delivery fee is a manually entered amount per order; the COD amount equals `totalAmount` plus the fee only when `feePaidBy = CUSTOMER`.

### MVP vs later

- **MVP (being built now):** schema; create COD sale with auto `dispatchRef`; status transitions; COD list page; manual courier/waybill/fee entry; manual settlement; revenue recognition changes; receivable card; refusal warning; audit entries; **dispatch sheet PDF**; **RET-WA-1 (customer confirmation link and one-tap WhatsApp messages)**. No courier integration. The courier waybill number is typed in by the seller (the courier issues it).
- **Later:** paste-chat-to-draft (RET-WA-1, third item), aging and refusal reports, automated WhatsApp/SMS (RET-WA Level 2, needs F-8 outbox), automatic release of unconfirmed orders (F-7), CSV import of courier settlement statements, courier API integration (confirm availability with each courier first), COD at an online storefront.

### RET-WA-1: WhatsApp-assisted flow (Level 1, no WhatsApp API)

The system never sends a WhatsApp message itself. It prepares links and prefilled text; the seller taps send in their own WhatsApp.

1. **Customer confirmation link.** On creating a COD sale in `PENDING_CONFIRMATION`, the system issues `confirmToken` (256-bit, from `src/lib/utils/token.ts`), expiring in 3 days. Public page `/cod-confirm/[token]` (outside the dashboard, like `/track` and `/customer-form`) shows the business name, items, total, delivery fee and the **amount to be collected**, with editable name, phone, address and city. Buttons: **Confirm order** (-> `PENDING_DISPATCH`, `confirmedBy = CUSTOMER`) and **I don't want this order** (-> `CANCELLED`, stock restored). The token works only while the order is `PENDING_CONFIRMATION` and unexpired; afterwards the page shows the current state read-only or "link expired". The page exposes nothing beyond that one order. Public routes live under `/api/v1/cod/confirm/[token]` (GET, POST) and must be added to the public matcher in `src/middleware.ts`. They must use conditional updates (`where: { status: PENDING_CONFIRMATION }`) so a double tap cannot apply twice.
2. **One-tap WhatsApp messages.** Buttons on the COD list and detail view open `https://wa.me/<number>?text=<prefilled>` (reuse the number normalisation from `send-whatsapp-button.tsx`) for: *Confirm your order* (with the link), *Dispatched* (courier + waybill), *Arriving today, please keep Rs. X ready*, and *Delivered, thank you*. Message text is built client-side from the current origin, never from a server environment URL.
3. **Paste chat -> draft (deferred).** Reuse the Gemini integration in `receipt-extract.service.ts` to turn pasted chat text into a draft COD sale. Not part of this release.

Acceptance criteria:
- A customer opening the link sees only their own order; a wrong or expired token shows a generic "link not valid" page.
- Confirming twice, or confirming a cancelled order, changes nothing the second time.
- Declining restores stock exactly once.
- The WhatsApp message buttons produce a correct link for numbers written as `0771234567`, `+94771234567` and `94 77 123 4567`.

### Decisions (answered by the product owner, 2026-10-27)

| # | Question | Decision | Effect on the build |
|---|---|---|---|
| 1 | Delivery fee | The seller sets the fee manually per order | Free amount field; no rate table. Payer defaults to the customer (see open point A) |
| 2 | Max COD amount / refusers | **No maximum.** Flag customers who often refuse | Refusal-check warning by phone number (warning only); configurable threshold |
| 3 | Couriers | Unknown for now, to be decided later | Courier is free text; nothing courier-specific is hard-coded; courier integration is deferred |
| 4 | Staff collecting cash | None: only one person handles retail | No cash-handover step in the MVP. Revisit if staff are added |
| 5 | Revenue recognition | **At delivery** | Revenue and profit include a COD sale only when `DELIVERED` or `REMITTED` |

Open points (assumptions made; confirm before release):
- **A. Who bears the fee.** "I will set the fee" was read as: the seller types the delivery charge per order and the customer pays it with the COD amount. The per-order `feePaidBy` switch stays so the seller can absorb the fee when needed. If the intended default is the opposite, change the schema default and the dialog default only.
- **B. Who can create settlements.** Settlements are ADMIN-only. Because one person runs retail, that person must hold the `ADMIN` role in the business, or the settlement route must be opened to `STAFF`. Confirm which.
- **C. Refusal threshold.** "Often" is configurable; default 2 earlier refusals triggers the warning.
- **D. Deferred.** Courier selection, courier fees and payout timing, API integration, cash handover for staff, and a maximum COD amount (explicitly not wanted now).

---

## 5. Delivery plan

| Phase | Window | Items |
|---|---|---|
| 0 | Days 0-30 | SEC-1, SEC-2, SEC-3, SEC-4, SEC-5, SEC-6, SEC-7, SEC-8, QA-1 (foundations: env, CI, first tests). In parallel (no new infra): F-1, F-3. |
| 1 | Days 31-60 | DATA-1, SEC-9, DATA-2, DATA-3, API-1, UPL-1, OPS-1, PERF-1. In parallel: F-2, F-4, F-5. |
| 2 | Days 61-90 | F-7, F-8, F-6, F-11, F-10, Recommendations decision, cleanup items below. **RET-COD MVP + RET-WA-1** (section 4A) is being built FIRST, ahead of Phase 0, with its own safeguards (see "Sequencing decision" in 4A). |
| 3 | After day 90 | F-9, F-12, F-13, F-14, Tier 3. |

Ordering rules: no payment gateway (F-10) or billing (F-11) before SEC-2 and DATA-1. No customer-facing notifications (F-6, F-9) before the outbox (F-8) and rate limiting (SEC-3).

---

## 6. Cleanup and hygiene backlog (Low)

- Remove 9 unused dependencies: `@tanstack/react-query`, `class-variance-authority`, `@radix-ui/react-dialog`, `-dropdown-menu`, `-select`, `-separator`, `-slot`, `-toast`, `-tooltip` (re-verify with a search before removing; `framer-motion` is imported once).
- Remove `sinhala-sample.pdf` from the repo root and `.claude/scheduled_tasks.lock` from tracking; update `.gitignore`.
- Remove unused code: `receiptUpdateSchema`, unused `AuditAction` values (`RECEIPT_FINALIZED`, `EXPENSE_RECORDED`, `EXPENSE_DELETED` per review; verify), stale comment in `customer.service.ts` about `customers/public/route.ts`.
- Rewrite `README.md`: actual endpoints (45 routes), real order lifecycle (`FABRIC_SELECTION` ... `COMPLETED`), per-membership roles including `PATTERN_MAKER`, env vars, migrations, deploy, backup and restore, secret rotation (including key versioning for `SECRET_ENCRYPTION_KEY`).
- API consistency: route `customers/public` and `api/public/receipt-pdf` through `handler`/envelope; return money in one format (string or number) everywhere; move direct-Prisma routes (`track`, `reminders`, `dashboard/stats`, `items`, `memberships`, super-admin plans) behind services.
- Extract a shared helper for the repeated `isDuplicate` (P2002) blocks in three services.
- `createBulkFromSample` (`receipt.service.ts:411-474`) must reject an already-converted sample (check `convertedToBulkId` inside the transaction) so a double-click cannot create two bulk orders.
- Make hard-coded tenant details configurable per business: advance percentage (60% appears in `receipt.service.ts:420` and `receipt-builder.tsx:202`), `INCOME_START_DATE = "2025-09-01"` (`income/page.tsx:20`), "MONTRA" in `income/page.tsx:107` and the PDF template (`receipt-template.ts:11-15`).
- Split large components: `receipt-builder.tsx` (728 lines), `folder-sync.ts` (508), `bulk-upload-shell.tsx` (428), `expenses-table.tsx` (334). Replace the 43 ad-hoc `alert`/`fetch` + `router.refresh()` mutations with a shared client and toast.
- Document the backup and restore plan (Neon point-in-time recovery depends on plan tier) and Prisma connection-limit guidance for serverless.
- Audit log gaps: PDF share events, failed authorisation attempts, customer delete details.

---

## 7. Definition of done (all items)

1. Code follows the existing layering (route -> service -> repository) and uses the standard response envelope.
2. Tenant scoping and role guard are present on every new route, and covered by a test.
3. Money uses `Decimal` and the shared `money` zod schema.
4. Mutations write an audit row in the same transaction.
5. Prisma migration included, applies with `migrate deploy`, and is reversible or has a documented rollback.
6. Unit or integration tests added; CI passes.
7. `README.md` or docs updated where behaviour changed.
