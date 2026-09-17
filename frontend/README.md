# Frontend

Next.js (App Router) + shadcn/ui (Base UI under the hood) + TanStack
Table/Virtual. See the repo-root README for the full local setup.

## Layout

```
app/
  page.tsx              home — two buttons: troubleshoot / view cases
  cases/page.tsx         all cases, virtualized TanStack Table
  cases/new/page.tsx     open-a-case form
  cases/[id]/page.tsx    case detail + troubleshooting-loop log
components/
  ui/                    shadcn primitives (generated; edit with care)
  command-menu.tsx        Cmd/Ctrl+K palette — keyboard nav between pages
  nav-bar.tsx             top nav
  cases-table.tsx          the virtualized cases table
lib/api/
  client.ts               shared fetch wrapper (the networking layer)
  types.ts                 types mirroring backend/app/schemas
  stations.ts, materials.ts, profiles.ts, cases.ts   per-resource clients
```

## Commands

```bash
pnpm install
pnpm dev      # -> http://localhost:3000, expects the API at :8000 (see .env.local)
pnpm lint
pnpm exec tsc --noEmit
```

`NEXT_PUBLIC_API_BASE_URL` (see `.env.local.example`) points at the FastAPI
backend; defaults to `http://localhost:8000/api`.
