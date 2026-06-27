# MONTRA — Customer Receipt & Order Management

A clean-architecture Next.js 15 backend foundation for managing customers,
receipts/quotations, finalization, order workflow, versioning, audit logging,
and template-driven PDF generation — built around MONTRA's actual receipt layout.

This package is the **verified foundation**: the full data model, the
clean-architecture core, one fully-worked vertical slice (Customers) as the
pattern to copy, the complete receipt service (totals → finalize → versioning →
order status → audit), and a **working, tested pdf-lib engine** that reproduces
the real MONTRA receipt to the pixel. UI pages are scaffolded as the next step
(see Roadmap) — the business logic they call already exists.

---

## Layered architecture

```
Route handler (src/app/api/v1/**)      ← thin: auth, validate (Zod), shape response
        ↓
Service (src/server/services/**)       ← business rules, transactions, audit. No HTTP, no Prisma details.
        ↓
Repository (src/server/repositories/**)← the only place Prisma is touched per entity
        ↓
Prisma → PostgreSQL (Neon)
```

PDF generation is its own module (`src/server/pdf/**`) so templates can be added
without touching business logic. Every API response uses one envelope
(`{ success: true, data }` or `{ success: false, message, errors }`).

**Why this matters for mobile:** a future React Native / Capacitor app calls the
exact same `/api/v1` endpoints. No business logic lives in the UI, so nothing is
rebuilt — only re-skinned.

---

## Key decisions (where reality differed from the brief)

The brief's Module 3 listed a simpler receipt (number, date, customer, items).
Your **actual** receipt (#335) carries more, so the model was extended to match
the real document rather than the simplified spec:

1. **Currency is LKR, numbers only.** The template shows `49,250`, no symbol —
   the engine formats with thousands separators and no currency glyph. Money is
   `Decimal(12,2)` everywhere (never floats) to avoid rounding drift.
2. **Payment + advance/balance fields.** The real receipt has Cash / Card / Bank
   Transfer / Other boxes plus `Advance Amount`, `Amount Paid`, and `Balance`.
   These are first-class fields: `paymentMethods PaymentMethod[]` and three
   Decimal columns. `balance = totalDue − advance − paid`.
3. **"Pattern −6,600" is an adjustment line.** Modeled as `ReceiptAdjustment`
   (label + signed amount), so any custom +/- line works, not just discounts.
   `totalDue = subtotal + Σ adjustments`. Verified: 202,750 − 6,600 = 196,150.
4. **Unit-price display** keeps your `985 x 50` convention in the PDF while
   storing a clean numeric `unitPrice`.
5. **Customer snapshot on the receipt** (`custName`, `custAddress`, …). A
   finalized document must not silently change if the customer record is later
   edited — so issue-time values are copied onto the receipt.
6. **Auth = Clerk** (per brief). Identity always comes from the verified session;
   role (`ADMIN` / `STAFF`) lives on a local `User` row mirrored from Clerk.
   Editing a *finalized* receipt is admin-only and forces a new version.

---

## Data model (Prisma)

`User · Customer · Receipt · ReceiptItem · ReceiptAdjustment · ReceiptVersion ·
OrderStatusHistory · AuditLog`

Indexes on the fields the brief calls out (customer name/phone/email, receipt
number, receipt status, order status, created date). Child rows cascade-delete
with their receipt. See `prisma/schema.prisma`.

---

## Receipt lifecycle

```
DRAFT ──(edit in place)──▶ DRAFT
  │
  └─ finalize ──▶ FINALIZED · orderStatus = PENDING
                      │  edit (admin) ──▶ snapshot prior state as ReceiptVersion, currentVersion++
                      └─ order: PENDING ▶ IN_PROGRESS ▶ COMPLETED  (or CANCELLED), each logged
```

Every meaningful action writes an `AuditLog` row inside the same transaction, so
the trail can never disagree with the data.

---

## PDF engine (verified)

`src/server/pdf/receipt-template.ts` draws the receipt with **pdf-lib** from a
data-driven template object (colors, geometry, heading). `render-receipt.ts`
maps a persisted receipt onto it and caches the brand assets in
`public/brand/`. PDF generation runs **only** on explicit request
(`POST /api/v1/receipts/:id/generate-pdf`) — the create screen uses a live HTML
preview instead. A regenerated sample (`receipt-335.pdf`) matches your original.

To add a second template later: define another template object + a mapper. No
service or schema change.

---

## REST API (`/api/v1`)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/customers` | server-side pagination, search, sort |
| GET/PUT/DELETE | `/customers/:id` | DELETE is admin-only |
| GET/POST | `/receipts` | filter by status / orderStatus / search |
| GET/PUT | `/receipts/:id` | PUT on finalized → admin + new version |
| POST | `/receipts/:id/finalize` | locks doc, sets order = PENDING |
| POST | `/receipts/:id/generate-pdf` | returns `application/pdf` |
| POST | `/orders/:id/status` | transition + history + audit |

---

## Setup

```bash
npm install
cp .env.example .env            # fill in Neon + Clerk keys
npx prisma migrate dev --name init
npm run dev
```

Deploy to Vercel with region `sin1` (co-located with Neon `ap-southeast-1`) for
low DB latency.

---

## Roadmap (what to build next, in order)

The backend below is done; these are the remaining UI/edge pieces:

1. **Clerk middleware** (`src/middleware.ts`) protecting `/dashboard` and `/api/v1`.
2. **Public customer form** (`/customer-form`) — React Hook Form + Zod, posts to
   `/api/v1/customers`, success page.
3. **Admin dashboard** — summary cards (counts), customer table, receipt builder
   with live HTML preview mirroring the PDF, TanStack Query for caching.
4. **Receipt builder UI** — item rows with auto-calculated totals, "Generate PDF"
   + "Finalize" actions.
5. **Version history & audit views.**
6. **Rate limiting** on public + write endpoints.

Replicate the **Customer slice** (repository → service → validation → route) for
any new entity — it's the canonical pattern.
