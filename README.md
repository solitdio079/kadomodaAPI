# Kado Moda API

This release fixes the storefront API integration findings. Catalog, account and
cart work can be deployed; commercial checkout remains closed. Authenticated
`POST /order` returns 503 `CHECKOUT_UNAVAILABLE`.

## Coolify deployment

Use the repository Dockerfile, exposed port **3000**, domain
`https://api.kadomoda.com`, and HTTP health check **GET /health** (200).
Mount persistent storage at **/data/uploads**, writable by node (UID 1000).

Set runtime variables from `.env.example`: DATABASE_URL, SECRET_KEY, BREVO_API_KEY,
CLIENT_LINK=https://kadomoda.com/ and CORS_ORIGINS for the storefront domains.
DIRECT_URL optionally supplies a direct migration connection; Docker falls back
to DATABASE_URL. Set TRUST_PROXY to the actual trusted proxy IP/CIDR for your
Coolify network, never `true` or wildcard. Authentication limits are in-memory
for one API instance; correct proxy configuration is needed to identify visitors.

The image installs locked dependencies, generates Prisma, applies migrations,
and starts the API. Back up production before applying the new migration.
It preserves rows, removes implicit relation ID 0 defaults, makes campaigns
optional, and adds demo tracking. Existing tokens require a fresh login because
access tokens now have an explicit purpose.

After deployment, check /health, anonymous /product, /category and /campaign,
a login, and rejection of anonymous/ordinary-user catalog mutations. /health
checks process availability, not database readiness. Docker is unavailable locally;
the container build and runtime need verification in this first deployment.

## Administrator and demo catalog

Set BOOTSTRAP_ADMIN_EMAIL=solitdio079@gmail.com, BOOTSTRAP_ADMIN_NAME to Djoko Keita,
and BOOTSTRAP_ADMIN_PASSWORD in the API's server-only runtime environment. Run:

```sh
npm run admin:bootstrap
```

Remove bootstrap variables after success. Passwords are hashed and never logged.
An existing account is promoted only when the supplied password matches; its
password is not reset. Never put these credentials in frontend/build variables.

Optional sample catalog commands:

```sh
npm run seed:demo
npm run seed:demo -- --list
# After reviewing the list, delete only this sample batch:
npm run seed:demo -- --delete --apply
```

Eight proposal products receive real category relationships, isDemo=true and unique
luxury-preview-v1: seed keys. Reruns preserve admin edits. ADMIN catalog endpoints
can edit/delete them. Cleanup keeps categories/images; referenced products may be
protected by database constraints. These are preview products, not approved stock.
Neither script runs automatically on deployment. Neither has been run on production.

## Changed API contracts

- Catalog reads are public; mutations and media uploads require ADMIN.
- Product PUT updates the same ID; PATCH accepts partial fields. Images remain if
  omitted. Supply categoryId; campaignId is optional/nullable. Multipart numbers
  are validated. Bulk CSV/XLSX imports require categoryId and validate all rows
  before insertion. Uploaded spreadsheets stay outside public storage.
- Cart replacement accepts an array of { productId, size, quantity } only. Prices,
  discounts and totals come from the database. Size/aggregate stock validation and
  replacement are atomic. A cart does not reserve inventory.
- Address input uses zipCode, mapped to zipcode. userId is not accepted; ownership
  comes from authentication. Addresses referenced by orders cannot be edited.
- Order reads are owner-scoped (ADMIN can read all). Only ADMIN can change status,
  with validated transitions. Payment/price/owner changes are rejected. Delete
  returns 405. Order creation returns 503 until checkout is implemented.
- New auth/validation/commerce errors have stable codes and Turkish messages.
  Legacy account messages can still be English; frontend feedback must use its
  authored Turkish error mapping.

## Verification

```sh
npm ci
npx prisma generate
npm run typecheck
npm test
```

Integration tests require an empty disposable local PostgreSQL database named
kadomoda_test. Apply migrations with DATABASE_URL and DIRECT_URL pointing only
there, then run `TEST_DATABASE_URL=<local-test-url> npm run test:integration`.
Tests reject nonlocal URLs and populated user tables. Never use production.

Passed locally: TypeScript, 7 unit tests, 10 integration tests, all 15 migrations
on a fresh database, and a schema drift check with no differences. No production
database changes, push or deployment were performed.

Before sales: per-size stock/reservations, immutable order/address/price snapshots,
shipping quotes, provider-verified payments, idempotent webhooks, refunds and full
purchase tests. Account recovery/session lifecycle, branded transactional emails
and the storefront admin UI remain later milestones. There is no runtime switch
that enables the old unsafe checkout code.


## Store content release — 2026-09-24

Deploy this API before the updated storefront. Migration 20260924000000_site_content
adds a standalone SiteContent table and does not remove existing records. Existing
ADMIN users remain valid. GET /site-content is public and returns only published
snapshots; /site-content/admin reads and writes require ADMIN. Each slug has a
private draft, separate public snapshot and revision for optimistic concurrency.
Publishing requires complete content and explicit confirmation. Draft edits do not
change a published page; unpublishing hides the page and retains its draft.

Allowed slugs: business, about, privacy, distance-sales, delivery, returns. Text is
plain text, rendered escaped by the frontend. No default legal content is seeded.
Populate and publish real merchant-approved text in /yonetim/bilgiler. Publication
validation checks format/completeness, not legal adequacy or iyzico approval.

Verified: 7 API unit tests, 11 local-database integration tests, all 16 migrations
and schema drift check. Production data has not been altered by these checks.


## Live demo catalog populated 2026-09-24

The requested eight proposal demo products were inserted into the live database
and their photos uploaded through the ADMIN API. Product IDs: 6–13. Records have
isDemo=true and luxury-preview-v1: seed keys; admin edits and deletion remain
available. The storefront and all eight photos were checked live. These records
are demonstration merchandise, not approved inventory for payment-provider review.
The seed timeout is now 60 seconds to accommodate the hosted database.

## Excel import with later photo editing

ADMIN-only `POST /product/bulk/preview` accepts multipart `file` (.xlsx or legacy
.csv), `categoryId`, and optional `campaignId`. It parses without inserting and
returns `{valid, count, rows, issueCount, issues}`. Issues use stable row/field and
reason codes. Responses show at most 100 issues. The first 20 preview rows are
shown in the frontend.

`POST /product/bulk` revalidates the upload, rejects errors atomically, checks for
existing name/variant pairs in the chosen category, and creates the entire batch
in a serializable transaction. Case and surrounding whitespace are normalized
for duplicate checks. A repeated/concurrent upload cannot insert another copy
through this endpoint. Regular product creation retains its existing behavior.

New templates have `name, details, sizes, total_qty, price, variant` headers.
Descriptions follow normal product validation. Sizes accept commas (legacy pipes
also work). Prices accept a comma or dot decimal separator without grouping.
Legacy five-column imports remain supported with empty descriptions; fill those
old descriptions when editing. The named `Urunler` sheet is preferred, otherwise
the first sheet is read. Other sheets are ignored. Formula/date/link/error cells
are rejected. Limits remain 5 MB and rows 2–1001; temporary files are private and
removed after both preview and commit, including failures.

Imported products have `images: []`. They are public catalog records with the
existing placeholder, and the admin's normal multipart product PUT adds photos
later without changing the product ID. No migration or new dependency is needed.
Both API and frontend must be deployed for the new workflow to appear.

## Hierarchical reference categories

Migration `20261110000000_category_hierarchy` adds nullable unique `slug`, nullable
`parentId` (self relation, restricted deletion), and `sortOrder` to Category. It
inserts the 63 category records in the current https://www.behicesaglam.com/
homepage navigation (checked 2026-11-10). The source URLs are retained in the
migration data and the frontend reference manifest. `Yeni Gelenler` is a listing
shortcut, and the parent “Tüm …” links are not extra category records.

The migration adopts matching unkeyed categories and legacy plural aliases
(Elbiseler, Ceketler, Etekler, Takımlar), preserving IDs/product foreign keys.
Unrelated categories and all products remain intact. Existing names may become
singular and/or be placed beneath their source parent. Standard API deployment
runs this migration automatically; no additional seed command is needed.

GET `/category` returns flat records with `parentId`, `slug`, and `sortOrder` for
clients to assemble. POST and PUT accept optional `parentId` (number/null) and
`sortOrder` (0–10000). Omitting parentId on PUT preserves the existing parent.
Missing parents and self/descendant cycles are rejected, with serializable writes
protecting concurrent edits. Deleting categories with children/products returns
409. GET `/product/category/:categoryId` includes descendant categories.

Verified on an isolated local database: all 63 source names, ordering and parent
links match; migration preserved 11 existing product-category assignments. The
integration suite also covers hierarchy CRUD, cycles, descendant reads, and
protected deletion. No production migration has been executed by this change.
