# InGen — Claude Development Guide

Product catalog + commercial invoice generator for an export business (decorative lighting, article numbers 25001–25010 in the seed).

## Stack at a glance

- **Monorepo** — root `package.json` uses `concurrently` to run both apps. Each workspace has its own `node_modules`. Install with `npm run install:all`.
- **Client** ([client/](client/)) — Vite 5, React 18, TypeScript strict, MUI v6 + `@mui/x-data-grid`, React Router v6. Local `useState` only; no global store.
- **Server** ([server/](server/)) — Express 4, Prisma 5, SQLite (`server/prisma/dev.db`), `ts-node-dev` for reload. PDFs via `pdfkit`, image uploads via `multer` (disk).
- **Dev wiring** — Vite proxies `/api` and `/uploads` to `http://localhost:4000`. Client always uses relative paths.

## Commands

```bash
npm run install:all      # install root + client + server
npm run db:migrate       # prisma migrate dev on server
npm run seed             # insert 10 sample items
npm run dev              # server :4000 + client :5173
npm run db:studio        # open Prisma Studio
```

## Environment

`server/.env` (gitignored) — required keys:

```
DATABASE_URL="file:./dev.db"
PORT=4000
SHIPPER_NAME=Your Company
SHIPPER_ADDRESS=Street, City, Country
SHIPPER_PHONE=+91 0000000000
```

`SHIPPER_*` values appear in every generated PDF header. Restart the server after editing.

## Data model

3 tables in [server/prisma/schema.prisma](server/prisma/schema.prisma):

- **Item** — catalog row. `articleNumber` is unique. Both `productSize` (free-text descriptive) and structured `length/width/height/dimensionUnit` coexist. `priceUSD` is the source of truth; `currency`/`exchangeRate` are auxiliary. `priceUpdatedAt` is stamped on create and when price/currency changes.
- **Invoice** — customer, transportation fields (Country of Origin/Destination, ports, vessel, etc.), `totalUSD`, plus a unique `invoiceNumber`.
- **InvoiceItem** — line item. Snapshots `articleNumber`, `productName`, `productSize`, `material`, `netWeight` from Item at creation time. FK to Item is `ON DELETE RESTRICT`.

## API surface

All routes registered in [server/src/index.ts](server/src/index.ts). Routers under [server/src/routes/](server/src/routes/).

- `GET  /api/items` · `GET /api/items/:id` · `POST /api/items` · `PUT /api/items/:id` · `DELETE /api/items/:id`
- `GET  /api/invoices` · `GET /api/invoices/:id` · `POST /api/invoices` · `GET /api/invoices/:id/pdf`
- `POST /api/uploads` (multipart `image` field, 2 MB max, image mimetype only)
- `GET  /api/health`

Error shape is `{ error: string }` with an HTTP status. Prisma codes translated: **P2002 → 409**, **P2025 → 404**.

## Conventions to follow

**Server**

- New endpoints get a router under `server/src/routes/` and are mounted in [index.ts](server/src/index.ts).
- Validate at the boundary using the helpers already used in [items.ts](server/src/routes/items.ts) (`validatePositive`, `normalizeUnit`, `normalizeCurrency`, `toFloat`, `toFloatOpt`). Reuse them; don't reinvent.
- **Server is authoritative on price and snapshot fields for invoices.** `POST /api/invoices` accepts only `{ itemId, quantity }` per line and re-reads unit price and descriptive fields from the Item table inside the transaction. Do not weaken this — see [server/src/routes/invoices.ts:56-104](server/src/routes/invoices.ts#L56-L104).
- Invoice numbering (`INV-{year}-{4-digit-seq}`) is generated inside the create transaction via [server/src/services/invoiceNumber.ts](server/src/services/invoiceNumber.ts). Safe under SQLite's single-writer; would need rework for multi-writer DBs.
- Round money with `+(n).toFixed(2)` — same pattern used everywhere.

**Client**

- All HTTP goes through the `api` wrapper in [client/src/api/client.ts](client/src/api/client.ts). Do not call `fetch` directly in components.
- Types live in [client/src/types.ts](client/src/types.ts) and mirror the Prisma schema. Update both together when the schema changes.
- MUI components only. Snackbar + Alert is the standard feedback pattern (see [ItemMaster.tsx](client/src/pages/ItemMaster.tsx) and [InvoiceGenerator.tsx](client/src/pages/InvoiceGenerator.tsx)).
- Form dialogs follow the [ItemFormDialog.tsx](client/src/components/ItemFormDialog.tsx) shape: local form state, `useEffect` to reset on `open`, explicit save handler with client-side validation before POST/PUT.
- DataGrid tables use `autoHeight`, `disableRowSelectionOnClick`, and a page-size selector of `[10, 25, 50, 100]`.
- Derived values that are UX-only (like CBM) are computed on the client and sent verbatim. Trust-sensitive totals (invoice total) come back from the server.

**Naming**

- Use **InGen** everywhere — repo, code, UI, docs. (Any lingering "Billora" strings are legacy; replace them when you see them.)

## Known non-obvious behaviors

- **Exchange-rate fetch is a hardcoded mock** in [ItemFormDialog.tsx](client/src/components/ItemFormDialog.tsx) (`fetchInrRate`). The real API call is commented out and a fixed rate object is returned. Intentional — treat as demo/offline mode. Do not silently switch to a live provider without confirming intent.
- **Materials storage** — `Item.material` is a single comma-separated string like `"Iron: 1.2 kg, Acrylic: 300 g"`. The client parses/serializes it as up to 5 `{name, breakup}` rows. Don't try to query individual materials from the DB — it's not normalized.
- **Item delete is blocked** when any invoice references the item (409). Both the route handler and the FK constraint enforce this. For "archive" UX, add an `archived` flag; do not switch the FK to Cascade — invoice history must remain intact.
- **`InvoiceItem` snapshots `netWeight` but not `grossWeight`.** Intentional — check before adding.
- **Uploads are not cleaned up** when an Item's image is replaced or the Item is deleted. Orphaned files are known.
- **No auth on any endpoint.** All `/api/*` and `/uploads/*` paths are public.

## Testing & CI

None. No test runner, no linter, no GitHub Actions. TypeScript `strict` is the only automatic gate; the client build (`tsc -b && vite build`) catches type errors.

To verify a change, run `npm run dev` and drive the UI at http://localhost:5173. Don't invent test scaffolding unless asked.

## Directory map

```
InGen/
├─ package.json                          # root — orchestrates client+server via concurrently
├─ README.md
├─ CLAUDE.md                             # this file
├─ client/
│  ├─ index.html                         # <title>InGen Invoice Generator</title>
│  ├─ vite.config.ts                     # proxy /api and /uploads → :4000
│  ├─ tsconfig.json                      # strict, react-jsx, bundler resolution
│  └─ src/
│     ├─ main.tsx                        # ThemeProvider + BrowserRouter + App
│     ├─ App.tsx                         # Routes: /, /invoices/new, /invoices
│     ├─ theme.ts                        # MUI theme (light, blue primary)
│     ├─ types.ts                        # Client-side types mirroring Prisma
│     ├─ api/client.ts                   # HTTP wrapper — extend, don't bypass
│     ├─ components/
│     │  ├─ Layout.tsx                   # AppBar + nav
│     │  ├─ ItemFormDialog.tsx           # Add/edit product dialog
│     │  └─ ItemPicker.tsx               # Autocomplete for invoice lines
│     └─ pages/
│        ├─ ItemMaster.tsx               # / — catalog grid
│        ├─ InvoiceGenerator.tsx         # /invoices/new — build + submit
│        └─ InvoiceList.tsx              # /invoices — history + PDF download
└─ server/
   ├─ tsconfig.json                      # strict, CommonJS, dist/ output
   ├─ prisma/
   │  ├─ schema.prisma                   # 3 tables — source of truth for DB
   │  ├─ seed.ts                         # 10 sample items
   │  ├─ dev.db                          # SQLite file (gitignored)
   │  └─ migrations/                     # applied in order
   ├─ uploads/                           # gitignored — served at /uploads
   └─ src/
      ├─ index.ts                        # Express bootstrap + router mount
      ├─ db.ts                           # PrismaClient singleton
      ├─ middleware/upload.ts            # multer config + /api/uploads route
      ├─ routes/
      │  ├─ items.ts                     # CRUD + validation helpers
      │  └─ invoices.ts                  # create in transaction, PDF stream
      └─ services/
         ├─ invoiceNumber.ts             # INV-{year}-{seq} generator
         └─ pdf.ts                       # pdfkit layout for commercial invoice
```

## Before shipping a change

1. If touching invoice creation, verify the server-authoritative pricing rule is intact.
2. If touching the Prisma schema, generate a migration (`npm run db:migrate`) and update [client/src/types.ts](client/src/types.ts) to match.
3. If touching PDF layout, open a generated PDF at `/api/invoices/:id/pdf` and eyeball it — no snapshot tests exist.
4. If adding a client API call, extend `api` in [client/src/api/client.ts](client/src/api/client.ts).
5. Run `npm run dev` and exercise the golden path (add item → generate invoice → download PDF).
