# API changes

What changed in this API, newest first, written for whoever has to keep the
frontend (or any other client) working against it.

Two things this file is for: knowing **what breaks** before you pull, and
knowing **why** a decision was made so it is not quietly undone later.

> The frontend keeps the other half of this conversation in
> `nestjs-bids-bazar-api/../bids-bazar/docs/OPEN-ITEMS.md` (numbered `A<n>`
> items — API asks with verified repro commands) and
> `docs/BACKEND-INTEGRATION-LOG.md` (which commits here it has caught up with).
> The `A<n>` references below point there.

---

## 2026-09-23 — identity split, and a pass over the open API asks

One branch, two bodies of work. They are interleaved across the same files, so
they land together.

### ⚠️ Breaking for clients

| Change | What to do |
|---|---|
| `users.name` is **gone** | Use `username`. A person's legal name is now `kyc.fullName`, readable only once APPROVED. |
| `POST /auth/register` rejects `name` | Stop sending it — `forbidNonWhitelisted` 400s the request. |
| `PATCH /users/me` (display-name change) **removed** | Names are corrected by resubmitting KYC. `POST /admin/users/:id/reset-name-change` is gone with it. |
| `POST /kyc/phone/send-otp` and `/verify-otp` **moved** | Now `POST /users/me/phone/send-otp` and `/verify-otp`. `send-otp` takes `{ phone }` — the number is no longer read off the KYC row. |
| `kyc.primaryPhone` / `phoneVerifiedAt` **gone from KYC** | On the user: `user.phone`, `user.phoneVerifiedAt`, `isPhoneVerified`. Admin KYC reads echo `applicantPhone` / `applicantPhoneVerified`. |
| `kyc.secondaryPhone` → `kyc.emergencyContactPhone` | Renamed — "secondary" meant nothing once there was no primary beside it. |
| `POST /kyc/submit` requires `fullName` and `documentId` | Both new and both mandatory. |
| `POST /kyc/submit` requires a **verified phone** | 400 `Verify your phone number before submitting KYC` otherwise. |
| Credential hashes no longer appear in any response | If anything parsed around them, it can stop. |

### Identity: the account keeps a phone, KYC keeps the name

Migration `MoveIdentityToKycAddPhoneAndShipping1790000200000`. It backfills
before it drops — read it before running it anywhere with data.

- **`users.name` → `kyc_verifications.fullName`.** A name is a *verified*
  attribute: it is whatever the document says. Keeping an unverified copy on the
  profile meant two names per account with nothing deciding which was
  authoritative. `username` is the public identity everywhere now, including
  transactional email.
- **Phone verification moved KYC → User**, because it now *precedes* KYC rather
  than hanging off it. A pending number is held in `users.pendingPhone` and only
  promoted to `users.phone` when the code checks out, so requesting a code for a
  new number cannot cost someone the number they already verified. `users.phone`
  is uniquely indexed.
- **`kyc.documentId`**, unique per `(documentType, documentId)` — one physical
  document backs one account. Scoped by type because citizenship, passport and
  NID numbers are unrelated sequences that could coincide.
- **`shipping_addresses`** (max 5/user, enforced in the service so the cap comes
  with a message). `product_payments` gains `shippingAddressId` **and** a
  `shippingAddressSnapshot`: the id answers "which saved address was this", the
  snapshot is what the parcel was addressed to. Editing or deleting a saved
  address must not rewrite where a past order went.

**Migration notes.** `users.phone` is unique and nothing previously stopped two
KYC rows carrying the same number — on the dev DB three accounts shared one.
The backfill ranks by *verified first, then oldest*: the winner keeps the
number, the rest are left null and re-verify. It does not fail, and it does not
pick arbitrarily.

**Grandfathering.** An already-APPROVED KYC is untouched and its seller keeps
working even with an unverified phone. Everyone else must verify before
submitting. Approving a *pending* row still requires it.

### KYC resubmission — three faults in one path

The frontend could not let a rejected applicant correct their submission. It was
not one bug:

1. `submitKyc` **required every document on every submission** and **deleted the
   old files before writing the new ones**. Correcting a ward number meant
   re-photographing a passport, and a failure part-way through left a record
   pointing at files that no longer existed.
2. `GET /kyc/me` returned document URLs built by `getVirtualDocumentUrl`, which
   points at the **admin-only** `/kyc/:id/documents/:fileKey`. Those links
   answered 403 for the person who uploaded the files — which is why the
   correction form could only ever say "Already uploaded".
3. A rejection was prose only, so nothing could point at *which* document was
   wrong.

Now:

- Files are **optional on a resubmission**; an omitted slot keeps what is stored.
  Switching document type still carries nothing over.
- New files are **written first**, and superseded ones deleted only after the
  record points at their replacements. A failed upload cleans up after itself
  and leaves the record untouched.
- **`GET /kyc/me/documents/:fileKey`** serves the caller their own documents —
  JWT-scoped (no id in the path), `private, no-store`, sandboxed CSP.
- **`rejectedFields`** on `PATCH /kyc/:id/review` and on every KYC read. Valid
  keys are in `src/modules/kyc/kyc-rejectable-fields.ts`; the frontend mirrors
  that list, so adding a key here needs a label there.

### Security

- **`User.password` and `User.hashedRefreshToken` carry `@Exclude()`**, with a
  global `ClassSerializerInterceptor` in `main.ts`. Fixed at the entity, not per
  endpoint: `/admin/bids`, `/payments/admin/all` and
  `/admin/products/:id/settlements` all shipped bcrypt hashes to any
  authenticated admin client, and patching them one at a time would have left
  the next one to be written exposed. (A1, A11, A25.)
  `@Exclude()` is a serialisation guard, not a read guard — login and refresh
  still compare the columns normally.
- **CORS**: `.env.development` was overriding `.env` with ports this project
  stopped using, so both SSE streams were dead in the browser. Config loads
  `['.env.development', '.env']` and **the first file wins** — that precedence is
  now commented at the `envFilePath` and in `.env.example`, and `main.ts` logs
  the resolved allow-list at startup, because the failure was only ever visible
  in a browser console. (A24.)

### Data integrity

- **`winningBidId` is repointed when the win moves** (at fallback promotion and
  at both settle paths), and **`products.settledAmount`** records what the lot
  actually sold for. These differ whenever a payment cascaded: the highest bid
  belongs to whoever did not pay. Before this, the public "recently sold" feed
  advertised a price the lot never sold for. Migration
  `AddProductSettledAmount1790000100000` backfills both from the CONFIRMED bid.
  (A26.)
- **`AddProductSettlementAndRenamePayments1789999241844` was rewritten.** It
  dropped `payments` as its *first* statement and created the replacement empty
  — fine on the author's empty DB, silent loss of the entire payment history on
  any other, and it left `product_settlements` empty so `handlePaymentExpiry`
  and `confirmPaymentGateway` would throw on every already-closed lot. It now
  creates the tables, backfills settlement rounds from the bid history, copies
  every payment across **with its id preserved** (so `seller_ratings.paymentId`
  still resolves), asserts nothing was orphaned, and only then drops the old
  table. Tested against a seeded non-empty database, which the original never
  was. (A27.)

  **Run migrations with `-t each`.** TypeORM's default wraps the whole pending
  set in one transaction, so one failure rolls back migrations that already
  succeeded.

### New and changed endpoints

| Endpoint | Change | Ask |
|---|---|---|
| `GET /users/:id` | New. Admin user-detail had to page `/users` and scan client-side, capped at 100 accounts. | A9 |
| `GET /users/me/phone`, `POST /users/me/phone/send-otp`, `POST /users/me/phone/verify-otp` | Moved from `/kyc/phone/*`. | — |
| `GET/POST/PATCH/DELETE /users/me/shipping-addresses` | New, JWT-scoped, max 5. | — |
| `GET /kyc/me/documents/:fileKey` | New, self-scoped. | — |
| `GET /kyc?userId=` | New filter. `status` also changed `where`→`andWhere`, so the two now combine. | A10 |
| `GET /products/me?status=` | New filter, via `ListMyProductsQueryDto` — deliberately **not** on the shared DTO, since that one also backs public `/products`. | A2 |
| `PATCH /admin/categories/reorder`, `/admin/subcategories/reorder` | New. One transaction, all-or-nothing. | A18 |
| `GET /admin/categories?withCounts=true` | Adds `subcategoryCount` via one grouped query. | A18 |
| `DELETE /admin/categories/:id/permanent`, `/admin/subcategories/:id/permanent` | New. 409s with a count when anything references the row. | A19 |
| `GET /products/:id` | Adds `bidRange`; `auction.update` SSE frames carry it too. | A14 |
| `auction.update` SSE | Adds `totalBids`, `newBidsToday`, `viewCount`. | A13 |
| `GET /bids/me` | Adds `paymentId`, `hasRated`, `canRate`. | A15 |
| `POST /payments/:id/initiate`, `GET /payments/:id/status` | Add `itemAmount`, `deliveryCharge`, `deliveryZone`, `shippingAddress`. `initiate` accepts `shippingAddressId`. | A3 |
| `POST /products` / `PATCH /products/:id` | `isRare` accepts `'true'`/`'false'` (multipart sends strings); `clearFields[]` unsets a draft field. | A16, A21 |
| `POST /products/:id/submit` | `missingFields` now survives the exception filter, and the same list is published as `missingSubmissionFields` on the owner's listings. | A20 |

Two decisions worth not undoing:

- **`bidRange` bounds are snapped to the Rs. 5 step before publication.**
  `placeBid` rejects any amount that is not a multiple of 5, but `minAmount` can
  come straight from `biddingStartPrice`, and rows predating that rounding carry
  values like `135435.30`. Publishing it unrounded hands clients a "bid the
  minimum" button the API refuses — the exact bug the endpoint exists to prevent.
  The `message` is rebuilt from the snapped figures so the text names the same
  numbers the buttons send.
- **`clearFields` is an explicit list, not "empty string means clear".** A form
  that posts all of its inputs sends `""` for every field the user simply has not
  filled in, so that reading would silently wipe data on an ordinary save.

### Still open

`A5` (three response envelopes — breaking across every list endpoint, needs its
own migration), `A7` (both `package-lock.json` and `pnpm-lock.yaml` are present;
picking one changes what CI installs, so it is the repo owner's call), `A8` (not
reproduced), `A12` (email alerts — a feature, not a defect), and `A29`
(`/payments/admin/all` and `/admin/bids` embed whole nested product entities to
render a title).

`A28` is **resolved as designed**: `deliveryCharge` is stored but deliberately
not added to the Fonepay QR amount — delivery is cash on arrival, which the
checkout UI states. Do not let a client sum `amount` and `deliveryCharge` into a
single "you owe" figure.
