# Artisan Shop — Learn the Whole Project, A to Z

This is a guided reading order for the codebase, not a file listing. Each phase
builds on the last. Don't try to understand everything in one file before
moving to the next — skim, move forward, and come back once you have more
context. That's genuinely how this codebase was built, feature by feature,
and it's the easiest way to re-learn it too.

Budget: this is realistically a few focused sessions, not one sitting.

---

## Phase 0 — The 60-second mental model

Before opening a single file, hold this picture in your head:

```
Browser (React)  <-- HTTP/JSON, credentials: cookies -->  Express API  <-->  Postgres
      |                                                         |
      |                                                         +--> Cloudinary (images)
      |                                                         +--> Resend (emails)
      +--> Chargily's hosted page (payment, browser redirects there directly)
                                                                 +--> Chargily webhook -> Express
```

Two separate npm projects, two separate `package.json`s, run as two separate
processes in dev (`backend` on :4000, `frontend` on :5173). They only ever
talk over HTTP — the frontend never imports backend code or vice versa.

**Everything in this app revolves around one idea: who is allowed to do what.**
Three roles (`customer`, `admin`, `super_admin`), and almost every interesting
piece of backend code exists to enforce a boundary between them. Keep that
lens on as you read.

---

## Phase 1 — Run it once before reading anything

You will understand the code ten times faster after you've clicked through
the app once as a user. Do this first:

1. `backend`: `npm install`, set up `.env` (copy `.env.example`), create the
   Postgres DB, run migrations, `npm run dev`.
2. `frontend`: `npm install`, `npm run dev`.
3. Open the app. Register an account. Browse products. Add to cart. Check
   out as a guest. Look at the confirmation page.
4. Promote yourself to `admin` or `super_admin` via SQL (see README), log
   back in, poke around `/dashboard`.

You now have a mental map of "what does this app *do*" before you look at
"how does it do it." That ordering matters.

---

## Phase 2 — Backend foundations (read these first, in order)

Goal: understand how a request gets from "hits the server" to "touches the
database," with nothing interesting happening yet.

1. **`backend/src/index.ts`** — the actual process entry point. Connects to
   the DB, verifies the mailer, starts listening. Tiny, skim it.
2. **`backend/src/app.ts`** — the real heart of the HTTP layer. This is where
   every middleware gets stacked in order: `helmet` → CORS → the raw-body
   webhook route (special case, see Phase 6) → `express.json()` →
   `cookieParser` → `sanitizeBody` → rate limiting → then every route file
   gets mounted at its URL prefix (`/api/auth`, `/api/products`, etc).
   **Read this file slowly.** Middleware order is not cosmetic — get it wrong
   and things silently misbehave (we hit exactly this with the webhook route
   needing raw bytes before `express.json()` could touch them).
3. **`backend/src/config/data-source.ts`** — the TypeORM connection config
   and the full list of entities. This is your table of contents for "what
   data exists in this app" — skim every entity name here, don't open them
   yet.
4. **`backend/src/entities/User.ts`** — the simplest entity. Learn what a
   TypeORM `@Entity`/`@Column`/decorator looks like here, before the more
   complex ones (`Order`, `Coupon`) throw relations and business rules at you.
5. **`backend/src/middleware/auth.ts`** — `requireAuth`, `requireAnyAdmin`,
   `requireSuperAdmin`, `optionalAuth`, `attachShop`. This file *is* the
   authorization model of the whole app. Every route later just picks one
   (or more) of these off the shelf.

**Checkpoint**: you should be able to explain, in one sentence each, what
`requireAuth` vs `optionalAuth` vs `requireAnyAdmin` each do, and why
`attachShop` exists (it resolves *which* shop an `admin` — not `super_admin`
— is allowed to touch, since `super_admin` isn't scoped to any single shop).

---

## Phase 3 — One full vertical slice: Products

Pick the simplest real feature and trace it completely, backend to frontend,
before moving to anything more complex.

**Backend:**
- `backend/src/entities/Product.ts` — note the `shopId` relation. Every
  product belongs to exactly one shop.
- `backend/src/routes/products.ts` — read every route top to bottom. Notice:
  - `GET /` is public, no auth
  - `POST /`, `PUT /:id`, `DELETE /:id` all require `requireAnyAdmin` +
    `attachShop`, and manually check `product.shopId !== req.shopId` for the
    non-super-admin case
  - the query-builder-based search/sort logic (`ILIKE`, dynamic `ORDER BY`)
  - `validateUuidParam()` guarding the `:id` routes

**Frontend:**
- `frontend/src/api/products.ts` — the typed HTTP client wrapper. Every
  backend route has exactly one corresponding function here.
- `frontend/src/pages/Shop.tsx` — the public storefront page. Follow how
  `useQuery` from TanStack Query calls `productsApi.list(...)`, and how
  search/sort/page state flows into the query key (so changing any of them
  triggers a refetch automatically).
- `frontend/src/pages/dashboard/ProductsAdmin.tsx` — the admin CRUD screen.
  Same data, different UI, note the shop-scoping logic on the frontend side
  mirrors the backend's.

**Checkpoint**: you should be able to draw, from memory, the path of "admin
clicks Save on the product form" all the way to "row updated in Postgres."

---

## Phase 4 — Auth, for real (this is the deepest rabbit hole — go slow)

This is the single most conceptually dense part of the app. Don't rush it.

1. **`backend/src/utils/tokens.ts`** — `signAccessToken`, `issueSession`,
   the refresh-token creation/rotation functions. Read the comments closely;
   they explain *why* (short-lived JWT + long-lived hashed opaque refresh
   token, not one long-lived JWT).
2. **`backend/src/routes/auth.ts`** — register, login, refresh, logout,
   forgot-password, reset-password, role management. This is a long file;
   read it in that exact order, since later routes assume you understand
   the session model established by the earlier ones.
3. **`frontend/src/api/client.ts`** — the axios interceptor that
   transparently refreshes an expired access token and retries the original
   request. This is the frontend half of what `tokens.ts` sets up on the
   backend. The "one in-flight refresh shared across concurrent requests"
   logic here is worth understanding on its own.
4. **`frontend/src/store/AuthContext.tsx`** — how the frontend knows "who am
   I" at any given moment (a `useQuery` on `/auth/me`, cached).

**Checkpoint**: explain why there are *two* tokens (access + refresh)
instead of one, and what "rotating" a refresh token means and why it matters
if one gets stolen.

---

## Phase 5 — The hard concurrency concepts (do these back to back)

These three features all solve the same underlying problem — "what happens
when two requests try to do the conflicting thing at almost the same
instant" — with three different techniques. Reading them together makes each
one click faster.

1. **`backend/src/routes/orders.ts`, the `POST /` handler** — checkout.
   Read the whole transaction. Notice it validates *every* item's stock
   *before* touching any of them, and everything happens inside
   `AppDataSource.transaction(...)`.
2. **`backend/src/services/coupons.ts`** — `applyCouponWithLock`. This is
   the one true "race condition fix" in the app — a `pessimistic_write` row
   lock on the coupon row. Read the comments; this is the concept I walked
   through in depth earlier in our conversation if you want the longer
   explanation.
3. **Idempotency keys**, back in `orders.ts` — the `Idempotency-Key` header
   handling, and the `catch` block that specifically handles a Postgres
   unique-constraint violation (`23505`) as an *expected* outcome, not an
   error.

**Checkpoint**: without looking, explain what would go wrong in each of
these three if the lock/transaction/unique-constraint weren't there.

---

## Phase 6 — Everything that talks to the outside world

Each of these is a self-contained integration — read whichever you care
about most, in any order, once Phases 1–5 are solid.

- **Cloudinary (image uploads)** — `routes/upload.ts` +
  `frontend/src/components/ImageUpload.tsx`
- **Resend (emails)** — `config/mailer.ts`, `services/email.ts`,
  `emails/orderConfirmation.ts` / `emails/passwordReset.ts` (the actual HTML
  templates)
- **Chargily (payments)** — `services/chargily.ts`,
  `routes/payments.ts` (creates a checkout), `routes/paymentWebhook.ts`
  (the raw-body-parsed webhook handler — go back to `app.ts` from Phase 2
  and look again at *why* this route is mounted before `express.json()`,
  it'll make more sense now)

**Checkpoint**: for each integration, answer "if this external service goes
down right now, what happens to the rest of the app?" (Answer should
generally be: the core app keeps working, that one feature degrades
gracefully — that's a deliberate pattern throughout.)

---

## Phase 7 — The dashboard, as a whole

By now every individual piece (`ProductsAdmin`, `OrdersAdmin`, `CouponsAdmin`,
`UsersAdmin`, `Analytics`, `MyShop`) is understandable in isolation. Read:

- `frontend/src/components/DashboardLayout.tsx` — the sidebar, and how it
  conditionally shows/hides links based on `isSuperAdmin`
- `frontend/src/components/ProtectedRoute.tsx` — the frontend's own
  route-guarding, mirroring the backend's `requireAuth`/`requireAnyAdmin`
- `backend/src/routes/analytics.ts` — the raw-SQL aggregation queries. Note
  why raw SQL was chosen over the query builder here (date-truncation +
  multi-table joins get awkward to express type-safely).

---

## Phase 8 — Tests (read these *after* the features they test, not before)

- `backend/tests/helpers.ts` first — the vocabulary every test file uses
  (`createUser`, `createShop`, `loginAs`).
- Then `tests/auth.test.ts`, `tests/products.test.ts`, `tests/orders.test.ts`,
  `tests/passwordReset.test.ts` — in that order, easiest to hardest.

Tests are often the *fastest* way to confirm you actually understood a
feature: if you can predict what a test asserts before reading the
assertion, you understood the feature it's testing.

---

## A standing glossary of the "hard concepts," with where to see them live

| Concept | Where it's implemented | One-line idea |
|---|---|---|
| Race condition | `services/coupons.ts` | Two requests reading stale data before either writes back |
| Row-level lock | `applyCouponWithLock` (`setLock("pessimistic_write")`) | Force the second transaction to *wait*, not just retry |
| DB transaction | `orders.ts` checkout | All-or-nothing — a failure partway through undoes everything already done |
| Idempotency | `orders.ts`, `Idempotency-Key` header | A retried request returns the *same* result instead of creating a duplicate |
| Access + refresh tokens | `utils/tokens.ts` | Short-lived credential for requests, long-lived credential to mint new short-lived ones |
| Multi-tenancy | `middleware/auth.ts` (`attachShop`) | One codebase, many shops, strict data isolation between them |
| Raw-body webhook | `app.ts` + `paymentWebhook.ts` | Signature verification needs the *exact bytes* sent, before any JSON parsing touches them |

---

## How to actually retain this (not just read it once)

1. **Trace one request fully, by hand, on paper**: pick "customer applies a
   coupon and checks out," and write down every file the request passes
   through, in order, before opening any of them. Then verify against the
   real code.
2. **Break something on purpose.** Comment out the `setLock` call in
   `applyCouponWithLock`, then write a quick script (or just fire two
   requests nearly simultaneously with a limited coupon) and watch it
   actually over-apply. Seeing a bug happen teaches the fix better than
   reading the fix.
3. **Extend something small yourself** once Phases 1–5 feel solid — e.g. add
   a `wishlist` table and one endpoint. You'll naturally touch an entity, a
   route, a migration, and a frontend page, which is the whole loop.
