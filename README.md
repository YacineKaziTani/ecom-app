# Artisan Shop — Full-Stack E-Commerce

A complete e-commerce app with customer storefront + admin dashboard.

**Stack**
- Frontend: React 18, React Router v7, TanStack Query v5, Zustand, Tailwind CSS, TypeScript, Vite
- Backend: Express 5, TypeORM, PostgreSQL, JWT (httpOnly cookies), Zod, TypeScript

## Features
- Auth: register/login/logout, httpOnly JWT cookie, `/me`, profile update
- Products: list (search + category filter + pagination), detail page, full admin CRUD
- Categories: public listing, full admin CRUD
- Cart: Zustand store persisted to localStorage, quantity controls
- Orders: checkout creates order + decrements stock, customer order history, admin order list with status updates
- Dashboard: overview stats (products/categories/orders/revenue), products/categories/orders management, profile

## Setup

### 1. Database
Create a Postgres database:
```bash
createdb ecom
```

### 2. Backend
```bash
cd backend
cp .env.example .env    # set DATABASE_URL (or the DB_* vars) and JWT_SECRET
npm install
npm run migration:run   # creates all tables — synchronize is off everywhere, so this is required
npm run dev             # http://localhost:4000
```

### 3. Make yourself an admin
Register a normal account via the app, then promote it manually:
```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```
Vite proxies `/api` to `http://localhost:4000`, and the axios client sends cookies (`withCredentials: true`), so no CORS/cookie configuration is needed beyond what's already set up.

### Deploying (Render + Vercel + Neon)
The axios client always calls a relative `/api`, so the frontend must be served from the same origin as the API: `frontend/vercel.json` rewrites `/api/*` to the backend, which also keeps the auth cookies first-party. Point that rewrite at your backend URL.

**Backend (Render web service, root directory `backend`)**
- Build command: `npm ci --include=dev && npm run build` — `--include=dev` matters: with `NODE_ENV=production` set, a plain `npm install` skips devDependencies, so TypeScript wouldn't be there to build.
- Start command: `npm start`. Pending migrations run automatically on boot in production (`RUN_MIGRATIONS=false` to opt out).
- Health check path: `/api/health` (returns `503` when the database is unreachable).
- Environment — the server **refuses to start** in production if a required value is missing or unsafe, and logs warnings for the rest:

  | Variable | Notes |
  |---|---|
  | `NODE_ENV=production` | Secure cookies, migrations on boot, strict config checks |
  | `DATABASE_URL` | Neon connection string |
  | `JWT_SECRET` | ≥ 32 characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Rotating it is painless — sessions are restored from refresh tokens. |
  | `CLIENT_URL` | The Vercel origin, e.g. `https://your-shop.vercel.app` (CORS + links in emails/payments) |
  | `API_PUBLIC_URL` | This backend's public https URL (Chargily webhooks) |
  | `TRUST_PROXY=2` | Proxy hops in front of the app (Vercel rewrite → Render). Without it every visitor shares one rate limit. Verify: open `https://<frontend>/api/health` — `ip` should be your own address. |
  | `CHARGILY_API_KEY`, `CHARGILY_MODE` | `live` key + `CHARGILY_MODE=live` for real payments |
  | `RESEND_API_KEY`, `MAIL_FROM` | Sender must be on a domain verified in Resend |
  | `CLOUDINARY_*` | Image uploads |
  | `SENTRY_DSN` (optional) | Error tracking |
  | `ORDER_RESERVATION_MINUTES` (optional) | Default 30 |

- If you're on Render's free tier, the service sleeps when idle and takes ~50s to wake — the first visitor (or a Chargily webhook) waits for that. Use a paid instance for a real store.

**Frontend (Vercel, root directory `frontend`)** — default Vite settings. Optional: `VITE_SENTRY_DSN` for browser error reports.

**Database (Neon)** — check your plan's point-in-time-restore window, and do a test restore into a branch once so you know the procedure before you need it.

## Project structure
```
ecom/
  backend/
    src/
      config/data-source.ts   # TypeORM connection
      entities/                # User, Category, Product, Order, OrderItem
      middleware/auth.ts       # JWT auth + admin guard
      routes/                  # auth, products, categories, orders
      index.ts
  frontend/
    src/
      api/                     # axios client + typed API calls
      store/                   # AuthContext (TanStack Query) + cartStore (Zustand)
      components/              # Navbar, layouts, ProductCard, ProtectedRoute, StatCard
      pages/                   # Shop, ProductDetail, Cart, MyOrders, Profile, Login, Register
      pages/dashboard/         # Overview, ProductsAdmin, CategoriesAdmin, OrdersAdmin
      App.tsx                  # React Router v7 route tree
      main.tsx                 # QueryClientProvider + BrowserRouter + AuthProvider
```

## Multi-tenant shops (super_admin / admin / customer)

Roles:
- **`customer`** — browses, buys, sees their own orders. Default role on register.
- **`admin`** — owns exactly one `Shop`. Can manage only their own shop's products and see/update orders that contain their shop's items. Cannot touch categories (shared taxonomy) or other shops.
- **`super_admin`** — full control: every shop, every product, every order, plus manages the global category list and can promote/demote user roles.

Key model decisions:
- `Category` is global/shared across shops (e.g. "Jams", "Pottery") — only `super_admin` can create/edit/delete categories.
- `Product.shopId` is required — every product belongs to exactly one shop.
- `Order` itself is shop-agnostic (a customer's cart can span multiple shops in one checkout). `OrderItem.shopId` is a snapshot used to scope what a shop-admin can see: their `/orders` list only shows orders containing at least one of their items, and the `items` array returned is filtered down to just their own lines. `order.total` still reflects the whole order for `super_admin`, but the frontend recomputes a shop-scoped total for `admin` from their filtered items.
- Updating an order's status as an `admin` is only allowed if every item in that order belongs to their shop — a mixed-shop order needs a `super_admin` to update it (future: move to per-item fulfillment status if you need shops to ship independently).

### Bootstrapping your first super_admin
There's a chicken-and-egg problem — no one can promote the first super_admin via the API since that requires... a super_admin. Use the seed script instead:
```bash
cd backend
npm run seed:super-admin -- you@example.com yourPassword123
```
This creates the user directly (or promotes them if the email already exists).

### Promoting further users
Once you have a super_admin, log in as them and call:
```
PATCH /api/auth/:id/role
Body: { "role": "admin" | "customer" | "super_admin" }
```
(No UI for this yet — wire up a simple user-management screen in the dashboard if you want one, or call it from Postman/curl for now.)

## Image uploads (Cloudinary)
Product, category, and shop-logo images are uploaded directly to Cloudinary instead of pasting a URL.

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. From your Cloudinary dashboard, grab **Cloud name**, **API Key**, **API Secret**
3. Add them to `backend/.env`:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. Restart the backend (`npm run dev`)

**How it works:** `POST /api/upload?folder=products|categories|shops` (admin/super_admin only) accepts a single `multipart/form-data` file field named `image`, uploads it to Cloudinary (auto-resized to max 1200×1200), and returns `{ url, publicId }`. The frontend's `<ImageUpload />` component (used in the Products, Categories, and My Shop admin forms) handles the file picker, preview, and calling this endpoint — the resulting `url` is what gets saved on the entity, same as before.

Uploads are capped at 5MB and restricted to image mimetypes on both the client and server side.

## Stock-out handling at checkout
Checkout (`POST /api/orders`) runs inside a database transaction and validates **every** cart line against current stock before touching anything — so a failure on item 3 can't leave item 1's stock already decremented. If one or more items are no longer available in the requested quantity (or a product vanished), the API responds `409` with:
```json
{ "message": "...", "issues": [{ "productId", "productName", "availableStock", "requestedQuantity" }] }
```
The frontend (`Cart.tsx`) catches this, automatically clamps the affected cart quantities down to what's actually available (or removes the line if it's fully sold out), highlights the affected lines, and shows a toast explaining what changed — so the customer can just review and resubmit instead of hitting a dead-end error.

## Shop pages
Since shops are now first-class (multi-tenant), customers can browse them directly:
- **`/shops`** — directory of all shops
- **`/shops/:slug`** — individual shop storefront: logo, description, and a paginated grid of that shop's products (reuses the same `ProductCard` and `Pagination` components as the main storefront)
- Product cards and the product detail page now link "by {shop name}" back to the shop's page

## Guest checkout
Customers no longer need an account to buy something:
- `POST /api/orders` uses `optionalAuth` — it works whether or not there's a valid session cookie. If the caller isn't logged in, `guestEmail` is required in the request body instead.
- `Order.userId` is now nullable, with a `guestEmail` column set for anonymous orders (exactly one of the two is present on any order).
- After checkout, both guests and registered customers land on `/order-confirmation/:id` with an order summary. Registered customers can also visit `/orders` for full history; guests get a one-time confirmation screen since they have no account to list orders under.
- **`GET /api/orders/track/:id?email=...`** — a public, unauthenticated lookup so a guest can check their order status later, as long as they provide the exact order ID and the email used at checkout. This only works for guest orders — a registered customer's orders stay private to their account and can't be looked up this way.
- `/track-order` — a simple frontend page wrapping that lookup.

## User management (super_admin)
- **`GET /api/auth/users?search=`** (super_admin only) — lists all users, optionally filtered by name/email.
- **`PATCH /api/auth/:id/role`** (already existed, now guarded against a super_admin accidentally demoting their own account and locking themselves out).
- **Dashboard → Users** — a table for super_admin to search users and change roles (`customer` / `admin` / `super_admin`) via a dropdown, with a confirmation prompt before applying. A user's own row has its role selector disabled (can't self-demote from the UI either).

## Order confirmation emails (Resend)
Every order (guest or registered) triggers a real transactional email — order ID, itemized summary, total, shipping address, and a "View your order" button linking straight to `/order-confirmation/:id`.

### Setup
1. Add your [Resend](https://resend.com) API key and sender to `backend/.env`:
   ```
   RESEND_API_KEY=re_...
   MAIL_FROM="Artisan Shop <orders@your-verified-domain.com>"
   ```
   (`EMAIL_FROM` is accepted as an alias for `MAIL_FROM`.) Until you verify a domain in Resend, the default `onboarding@resend.dev` sender can only deliver to your own Resend account's address.
2. Restart the backend — it logs whether Resend is configured.
3. Leave `RESEND_API_KEY` unset to disable emails entirely — checkout still works exactly the same, sending is just skipped (logged as a warning).

### How it works
- `config/mailer.ts` — the Resend client, built from `RESEND_API_KEY` / `MAIL_FROM`
- `emails/orderConfirmation.ts` — the actual HTML template (inline styles, table-based layout for email-client compatibility) plus a plain-text fallback; escapes all interpolated values (name, product names, address) since they come from request bodies
- `services/email.ts` — wraps send + error handling so a failed/slow email can never break or delay the checkout response
- In `routes/orders.ts`, the email is sent **after** `res.status(201).json(order)` — the customer gets their confirmation instantly regardless of email-provider latency, and any send failure is just logged
- Recipient name: the registered user's first name, or the guest's `guestName` (new optional field, collected on the guest checkout form in `Cart.tsx`) — falls back to "there" if a guest skipped it
- The email's "View your order" link points to `/order-confirmation/:id`, with `?email=` appended for guest orders so the link keeps working even without a login (see the guest-checkout section above)

## Input sanitization & stricter validation
- `helmet` sets standard security headers on every response (configured for a JSON-only API — CSP disabled since no HTML is served, CORP relaxed to `cross-origin` so the dev frontend on a different port can still fetch it).
- `middleware/sanitize.ts` runs on every request body: strips any HTML tags and null bytes, and trims whitespace, recursively through nested objects/arrays. Every field in this app (names, descriptions, addresses) is meant to be plain text, so this is a blanket defense against stored XSS regardless of which route it lands on — on top of each route's own zod validation.
- `middleware/validateUuid.ts` checks route params are well-formed UUIDs before they reach a database query, so a malformed id returns a clean `400` instead of an unhandled `500` from Postgres.
- `utils/validators.ts` — shared, stricter zod schemas reused across routes: `imageUrlSchema` (must be a real http(s) URL), length caps on names/descriptions/addresses, and `clampInt` for sane pagination bounds.
- Passwords now require 8+ characters with at least one letter and one number (previously just a bare 6-character minimum). Names are restricted to letters/spaces/hyphens/apostrophes.
- Shop creation/rename now checks for slug collisions (two shops with similar names could previously generate the same slug and hit a raw DB unique-constraint error) and returns a proper `409` instead.
- Order line items are capped (max 50 distinct items, max 1000 quantity per item) to prevent abuse via absurd payloads.

## Refresh tokens
Sessions now use a short-lived access token + long-lived, rotating refresh token instead of one long-lived JWT:
- **Access token** (`token` cookie): a 15-minute JWT, sent on every request. The cookie itself lives as long as the session so an *expired* JWT still reaches the server, which answers `401` and the client refreshes — this matters on guest-or-user routes like checkout, where a missing cookie would otherwise mean "guest".
- **Refresh token** (`refreshToken` cookie): a 30-day opaque random token, scoped to the `/api/auth` path only (never sent to other endpoints), stored **hashed** (SHA-256) in a new `refresh_tokens` table — the raw token is never persisted, so a database leak alone can't be used to forge sessions.
- **`POST /api/auth/refresh`** — exchanges a valid refresh token for a new access+refresh pair, *rotating* the refresh token each time (the old one is deleted, a new one issued). This means a leaked-and-reused refresh token gets invalidated for its rightful owner on their next legitimate refresh — a signal worth building alerting on if you take this further.
- The frontend's axios client (`api/client.ts`) handles this transparently: on any `401`, it calls `/auth/refresh` once and retries the original request. Concurrent requests that all 401 at once share a single in-flight refresh call rather than triggering a stampede of refresh attempts.
- Logging out deletes the refresh token from the database (not just clearing cookies), so a copied-out cookie can't be replayed after logout.
- Promoting/demoting a user's role (`PATCH /api/auth/:id/role`) now also revokes all of that user's existing refresh tokens, so a role change takes effect on their next refresh rather than only once their current access token happens to expire.

### New env vars
```
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
```
(replaces the old `JWT_EXPIRES_IN`)

## Rate limiting
`express-rate-limit`, applied in layers:
- A broad limiter on all of `/api` (300 requests / 15 min per IP) — a safety net against scraping/DoS that's generous enough to never bother normal browsing.
- `POST /api/auth/login` — 50 attempts / 15 min per IP. Keyed by IP rather than by email, since keying by email alone would let an attacker still brute-force many different accounts from a single IP without ever tripping a per-account limit.
- `POST /api/auth/register` — 50 accounts / hour per IP, against spam signups.
- `POST /api/auth/refresh` — 60 / 15 min per IP, as a backstop against a buggy or compromised client hammering it (it's not a credential-guessing target, since it requires already holding a valid refresh token cookie).

Each returns a `429` with a clear message once the limit is hit.

Limits are keyed by client IP, which only works if Express knows how many proxies sit in front of it — set `TRUST_PROXY` (see Deploying). Otherwise every visitor appears to come from the proxy's address and they all share one limit.

## Idempotency key on checkout
`POST /api/orders` accepts an optional `Idempotency-Key` header. If a request with the same key arrives again — e.g. the response was lost to a network timeout and the client retries, or a double-click slipped past the disabled submit button — the server returns the **original** order instead of creating a duplicate (and skips re-sending the confirmation email).

- `Order.idempotencyKey` — new nullable, unique column. Nullable so requests without a key (or older clients) are unaffected; unique so Postgres itself is the final backstop against a race.
- **Race handling:** if two requests with the same key arrive at nearly the same instant, both could pass the initial "does this key already exist?" check before either commits. The second `INSERT` then fails on the unique constraint (Postgres error `23505`) — instead of surfacing that as a `500`, the route catches it specifically and re-queries for the order that won the race, returning that one.
- **Frontend:** `Cart.tsx` generates one key per visit to `/cart` (`crypto.randomUUID()`, held in a ref so it survives re-renders but not remounts) and sends it on every checkout attempt from that page load — including retries after a stock-issue correction, since a 409 never actually creates an order under that key, so reusing it for the corrected resubmission is safe. A fresh key is generated naturally next time `/cart` is visited (React remounts the component after navigating away).

## Payments (Chargily Pay — EDAHABIA / CIB)
Checkout now has a real payment step, using [Chargily Pay](https://dev.chargily.com/) v2 — the Algerian payment gateway supporting EDAHABIA (Algérie Poste) and CIB (SATIM) cards.

### Setup
1. Create a Chargily Pay account and grab your **test** API secret key from the [Developers Corner](https://pay.chargily.com/dashboard/developers-corner) in your dashboard.
2. Add to `backend/.env`:
   ```
   CHARGILY_API_KEY=test_sk_your_secret_key_here
   CHARGILY_MODE=test
   CHARGILY_LOCALE=ar
   API_PUBLIC_URL=http://localhost:4000
   ```
3. **`API_PUBLIC_URL` must be a publicly reachable URL** pointing at this backend — Chargily's servers need to reach it to deliver the payment webhook. `localhost` will not work. For local development, run a tunnel:
   ```bash
   ngrok http 4000
   ```
   and set `API_PUBLIC_URL` to the `https://...ngrok-free.app` URL it gives you (no trailing slash). Restart the backend after changing it, since the webhook URL is baked into each checkout it creates.
4. Switch `CHARGILY_MODE=live` and use a live secret key once you're ready to accept real payments — test mode uses `https://pay.chargily.net/test/api/v2` and never touches real money.

### How the flow works
1. Customer fills the cart and clicks **Continue to payment** on `/cart` — this creates the `Order` exactly as before (stock reserved, confirmation email sent), with `paymentStatus: "unpaid"`.
2. The frontend immediately calls `POST /api/payments/create-checkout` with that order's id. The backend creates a Chargily checkout for the order's exact total and returns a `checkoutUrl`.
3. The browser does a full redirect (`window.location.href`) to that URL — Chargily's own hosted, secure payment page. This app never touches card details directly.
4. After the customer pays (or cancels), Chargily redirects them back to `/payment/success` or `/payment/failure` on this site.
5. **Separately**, Chargily sends a webhook (`POST /api/payments/webhook`) directly to your backend confirming the actual payment result — this, not the browser redirect, is the authoritative source of truth (a customer closing the tab before the redirect completes shouldn't be trusted either way). The webhook handler verifies Chargily's HMAC signature, then sets `Order.paymentStatus` to `"paid"` or `"failed"` and — on success — advances the fulfillment `status` from `"pending"` to `"processing"`.
6. Since the redirect can arrive slightly before the webhook does, `/payment/success` briefly polls the order (a few times, a couple seconds apart) before settling on a final "paid" / "still processing" message rather than trusting the redirect alone.
7. If payment fails, is abandoned, or `create-checkout` couldn't even be reached, the order stays unpaid and its items stay reserved for `ORDER_RESERVATION_MINUTES` — both `/orders` (registered customers) and `/order-confirmation/:id` (guests, via their emailed link) show a **Pay now** button that starts a fresh checkout and restarts that window. After it runs out the order is cancelled automatically (see *Stock reservation* below).

### Key implementation details
- `Order` gained `paymentStatus` (`unpaid`/`paid`/`failed`), `paymentProvider`, and `paymentCheckoutId` — fulfillment status and payment status are deliberately separate state machines.
- `services/chargily.ts` — thin wrapper around Chargily's REST API (checkout creation) and webhook signature verification (`HMAC-SHA256` over the raw request body, using your API secret key — see `dev.chargily.com/pay-v2/webhooks`).
- The webhook route (`routes/paymentWebhook.ts`) is mounted with its own `express.raw()` parser and registered **before** the app's global `express.json()` in `index.ts` — signature verification needs the exact raw bytes Chargily sent, and a JSON-parsed-then-re-serialized body would very often produce a different signature and fail verification for no real reason.
- `create-checkout` follows the same access rules as viewing the order: an account order needs its owner signed in, a guest order needs the checkout email (sent by the frontend). Cancelled or already-paid orders are rejected.
- A repeated "Pay now" click creates a brand-new Chargily checkout each time and overwrites `paymentCheckoutId` — this app treats each Chargily checkout as a single-attempt, expiring link (consistent with how Chargily's own hosted checkout pages behave), rather than trying to track multiple simultaneous checkout attempts per order.
- Amounts are sent to Chargily as whole DZD units (no cents/centimes) — see `createChargilyCheckout`.

### Currency
Chargily only charges in Algerian dinars, so every price in the UI and the emails is shown in DZD (`1 234,50 DA`, via `Intl.NumberFormat("fr-DZ")`) — what customers see is what they pay. Amounts are sent to Chargily rounded to whole dinars.

## Stock reservation for unpaid orders
Checkout takes items out of stock immediately, so an order that's never paid would otherwise hold them forever (and anyone could "buy out" the inventory with guest orders they never pay for).

- Every new order gets `reservedUntil` = now + `ORDER_RESERVATION_MINUTES` (default 30). Each "Pay now" restarts the window.
- A background job (`services/orderLifecycle.ts`, every minute) cancels unpaid `pending` orders past that deadline — stock goes back and the coupon use is released. Each order is re-checked under a row lock first, so it's safe with several server instances and can't race the payment webhook.
- If a payment lands after the order expired, the webhook re-reserves the stock and moves the order to `processing`. If the stock is gone by then, the order stays `cancelled` but `paid` (shown as such in the dashboard) and a warning is logged — that's a refund.
- Orders placed before this existed have no deadline; cancel stale unpaid ones from the dashboard to release their stock.
- Cancelling an order (by an admin or the job) also gives back its coupon use; reactivating consumes it again.

## Discount codes / coupons
Admins can create coupons (percentage or fixed-amount) that customers apply at checkout.

- `Coupon` entity: `code` (unique, always matched case-insensitively/uppercased), `type` (`percentage`/`fixed`), `value`, optional `minOrderAmount`, optional `maxUses`, `usedCount`, optional `expiresAt`, `isActive`.
- **Scoping:** a shop-admin's coupons are locked to their own shop (`shopId` set) and only apply to an order made up *entirely* of that shop's items — a mixed-shop cart can't get a partial discount, to keep the math unambiguous. A super_admin's coupons are platform-wide (`shopId` null) and work on any cart.
- **Dashboard → Coupons** — create/list/delete, toggle active/inactive with one click, see usage (`used / max`) and status (Active/Expired/Used up/Disabled).
- **Cart** — a coupon code field with an "Apply" button that calls `POST /api/coupons/validate` (public, no auth needed) to preview the discount before checkout; the preview recomputes the subtotal server-side from live product prices, never trusting a client-supplied amount.
- **Checkout** applies the coupon for real inside the same database transaction as stock validation (`services/coupons.ts` → `applyCouponWithLock`), using a **pessimistic row lock** on the coupon during that transaction — so two customers racing for the last use of a limited coupon can't both succeed; whichever transaction commits first "wins" the usage slot, and the second gets a clean "usage limit reached" error rather than an inconsistent `usedCount`.
- `Order` gained `subtotal`, `couponCode`, `discountAmount` — `total` is what's actually charged (`subtotal - discountAmount`). The confirmation email and every order-summary view (cart, confirmation page, `/orders`, admin orders table) show the subtotal/discount breakdown whenever a discount was applied, and just the total otherwise.

## Better search
- Product search now matches **name OR description** (case-insensitive) — previously only the name was searched, so a product only findable via a term in its description (e.g. "handmade in Oran") never showed up.
- Added a **sort** control (`Newest`, `Price: Low to High`, `Price: High to Low`, `Name: A-Z`) on the storefront (`/`) and each shop's page (`/shops/:slug`), backed by `GET /api/products?sort=`.
- The backend switched from a plain `findAndCount` to a TypeORM query builder for this endpoint, since combining an OR (name/description) with AND filters (category, shop) and dynamic sorting isn't expressible with a plain `where` object.

## Analytics dashboard
**Dashboard → Analytics** — revenue over time (line chart), top 5 products by revenue, and summary stats (total revenue, paid order count, average order value), with a 7/30/90-day range picker.

- `GET /api/analytics/overview?days=` (admin/super_admin only) does the aggregation in raw SQL (`AppDataSource.query`) rather than TypeORM's query builder — the `GROUP BY` date-truncation and multi-table joins involved are awkward to express type-safely and raw SQL is clearer here, with parameterized queries (`$1`, `$2`) so there's no injection risk.
- **Scoping**: a `super_admin` sees platform-wide numbers computed from `Order.total` (which already reflects any discount). An `admin` sees numbers computed from the sum of their own shop's `OrderItem` lines only — consistent with how `/orders` and the original dashboard Overview already scope a shop-admin's view, since one order can span multiple shops.
- Only counts orders where `paymentStatus = 'paid'` — pending/failed payments don't inflate revenue.

## Test coverage
Real integration tests using Jest + Supertest against an actual Postgres database (not mocked) — they exercise the live Express `app` end-to-end through real HTTP requests, real bcrypt hashing, real JWT signing, real database transactions.

### Setup
1. Create a disposable test database:
   ```bash
   createdb ecom_test
   ```
2. `backend/.env.test` is already included with working local defaults (`ecom_test` database, `postgres`/`postgres` credentials) — since it holds no real secrets, it's safe to commit and use as-is. Adjust it only if your local Postgres credentials differ. Tests always connect via these `DB_*` vars: `DATABASE_URL` and the rest of `.env` are never loaded under `NODE_ENV=test`, so the suite (which truncates every table) can't reach your real database.
3. Create the schema in the test database: `NODE_ENV=test npm run migration:run` (with `NODE_ENV=test` the migration command uses the `DB_*` settings from your shell / `.env.test`-style values, never `.env`). Tests **truncate** tables between runs but never create/alter the schema themselves.
4. Run the suite:
   ```bash
   npm test
   ```

### How it's structured
- `tests/loadEnv.ts` — loaded via Jest's `setupFiles`, points everything at `.env.test` so tests never touch your real dev database.
- `tests/testDb.ts` — connects/disconnects `AppDataSource`, and `clearDatabase()` truncates every table between tests (`afterEach`) so each test starts clean without needing a fresh DB per test.
- `tests/helpers.ts` — fast setup utilities (`createUser`, `createShop`, `createProduct`, `createCoupon` insert directly via repositories) plus `loginAs(role)`, which logs in through the **real** `/api/auth/login` endpoint so the returned `supertest` agent carries genuine access+refresh cookies, exactly like a real browser session.
- Tests run with `--runInBand` (see the `test` script) — they share one Postgres connection and truncate tables between tests, so parallel workers would race on the same tables.
- Rate limiters are automatically disabled when `NODE_ENV=test` (see `middleware/rateLimit.ts`) — integration tests legitimately call login/register far more rapidly than any real usage pattern would, and without this the suite would trip its own abuse limiters. This can't be used to bypass rate limiting outside of tests, since `NODE_ENV=test` is never set in dev or production.

### What's covered
- **`tests/auth.test.ts`** — register (including duplicate email, weak password, and HTML-stripping via the sanitizer), login (correct/incorrect/nonexistent credentials), `/me`, refresh token rotation, logout, and role-gated routes including the self-demotion guard.
- **`tests/products.test.ts`** — shop-scoped creation (an admin can't edit another shop's product), super_admin creating for any shop, image URL validation, search-across-description, and the malformed-UUID-returns-400 fix.
- **`tests/orders.test.ts`** — the checkout transaction's atomicity (proving a stock failure on one item doesn't partially decrement another), idempotency key replay, coupon application (percentage, fixed-amount capped at subtotal, max-uses exhaustion, shop-scope rejection on a mixed-shop cart), order visibility scoping between customers and shop-admins, and stock reconciliation on cancel/reactivate (below).

- **`tests/orderLifecycle.test.ts`** — reservation deadlines, the expiry job (stock + coupon use restored, paid orders never expired, no double-restock), coupon use on cancel/reactivate, duplicate cart lines, pagination/status filters, and the dashboard summary.
- **`tests/payments.test.ts`** — who may start a payment (guest email / account owner / cancelled / already paid) and the webhook: signature check, paid → processing, no downgrade of a paid order, and payments that arrive after the reservation expired.
- **`tests/platform.test.ts`** — the production configuration checks, `/api/health`, request ids and JSON 404s.

### CI
`.github/workflows/ci.yml` runs on every push and pull request: backend type-check, build, migrations against a real Postgres 17, a **schema drift check** (fails if an entity changed without a migration), the full test suite, and the frontend type-check + build.

### What isn't covered yet
The success path of starting a Chargily checkout (would need mocking Chargily's API), and frontend/browser tests (e.g. Playwright for the checkout flow).

## Stock reconciliation on order cancellation
A real gap that existed until now: cancelling an order (`PATCH /api/orders/:id/status` → `"cancelled"`) never gave the reserved stock back. Every cancellation permanently shrank the product's available inventory for no reason — a real store would drift further and further from accurate stock levels over time as cancellations happened.

Fixed, symmetrically, inside a transaction:
- **Cancelling** an order (transitioning *into* `"cancelled"` from any other status) restores each line item's quantity back to `Product.stock`.
- **Reactivating** a previously-cancelled order (transitioning *out of* `"cancelled"`) re-deducts that stock — but re-validates availability first, since other orders may have consumed it in the meantime. If there isn't enough left, the whole transition is rejected with a `409` and the same `issues` shape as a failed checkout, rather than silently letting stock go negative. The order stays `"cancelled"` if this happens — nothing partially applies.
- Setting the same status twice (e.g. cancelling an already-cancelled order) is a no-op — it doesn't double-restock.
- The admin orders dashboard now confirms before cancelling ("stock will be restored") or reactivating ("stock will be re-reserved if still available"), and surfaces a clear error listing which specific items don't have enough stock if a reactivation is blocked.

## Password reset
Until now there was no way for a user who forgot their password to get back in — a real gap. Fixed:

- **`POST /api/auth/forgot-password`** `{ email }` — always responds with the same generic message ("if an account exists...") whether or not the email is registered, so this can't be used to enumerate which emails have accounts. If the email does belong to a user, an email is sent with a reset link.
- **`POST /api/auth/reset-password`** `{ token, newPassword }` — validates the token, sets the new (bcrypt-hashed) password, and responds.
- **`/forgot-password`** and **`/reset-password`** frontend pages; "Forgot password?" now links from the login screen.

### Security details
- Tokens follow the same pattern as refresh tokens: a large random value is emailed to the user, but only its **SHA-256 hash** is ever stored in the new `password_reset_tokens` table — a database leak alone can't be used to reset anyone's password.
- **Single active token per user** — requesting a new reset link deletes any previous one, so only the most recent email's link actually works.
- **Single-use** — a token is deleted the moment it's successfully used; replaying the same link a second time fails.
- **1-hour expiry.**
- **Ends other sessions on reset** — a successful password reset revokes *all* of that user's refresh tokens, not just issues a new password. If the reset was prompted by a compromised account, this signs out whoever else might currently be logged in.
- Rate limited separately: 15 forgot-password requests/hour per IP (spam + enumeration-timing defense), 15 reset-password attempts/15min per IP.
- New password requirements match registration: 8+ characters, at least one letter and one number.

- Add role selection guard on register if you want to allow admin self-signup (currently all new users are `customer`; promote via SQL).

## Operations
- **Logging** — `pino` + `pino-http`: one JSON line per request in production (readable output in dev), with a request id that's echoed in the `X-Request-Id` header and included in `500` responses, so a user-reported error can be matched to its log lines. Cookies, auth headers and query strings are kept out of the logs.
- **Error tracking** — optional Sentry on both sides (`SENTRY_DSN` / `VITE_SENTRY_DSN`). Only unexpected errors are sent, with cookies, headers and request bodies excluded. Without a DSN, nothing is loaded.
- **Frontend resilience** — pages are code-split (the main bundle is ~120 kB gzipped; the charting library loads only on Analytics), an error boundary shows a recovery screen instead of a blank page, and a tab left open across a deploy reloads itself once instead of failing to load the new build's chunks.
- **Images** — Cloudinary URLs are requested at the size they're displayed, in WebP/AVIF where supported (`lib/images.ts`).
- **Database** — indexes on every foreign key plus trigram indexes for product search (migration `AddIndexes`).
- **Shutdown** — on `SIGTERM` (every deploy) the server stops accepting connections, lets in-flight requests finish, then closes the DB pool.
