# InGen

Product catalog + commercial invoice generator.

## Quick start

```bash
npm run install:all
npm run db:migrate          # creates server/prisma/dev.db and runs migrations
npm run seed                # inserts 10 sample items (article numbers 25001-25010)
npm run dev                 # backend :4000, frontend :5173
```

Open http://localhost:5173.

## Configure shipper info

Edit `server/.env`:

```
SHIPPER_NAME=Your Company
SHIPPER_ADDRESS=Street, City, Country
SHIPPER_PHONE=+91 0000000000
```

These appear at the top of every generated PDF. Restart the server after editing.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Runs server (Express :4000) and client (Vite :5173) concurrently |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:studio` | Open Prisma Studio to browse the DB |
| `npm run seed` | Insert sample items |
