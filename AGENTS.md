<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Local dev is SQLite. Prisma CLI reads `.env`; Next.js reads `.env.local`. If either is missing, copy `.env.example`. Do not set `TURSO_DATABASE_URL` or `TURSO_AUTH_TOKEN` locally — `src/lib/db.ts` switches to Turso when both are set.

- Install: `npm ci` (postinstall runs `prisma generate`; `DATABASE_URL` must already be in `.env`).
- Schema: `npx prisma migrate deploy` (non-interactive). `npm run db:migrate` is `prisma migrate dev` and can prompt.
- Dev server: `npm run dev` → http://localhost:3000
- Admin login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the env file (defaults in `.env.example`).
- Checks: `npm run lint` (the repo currently has pre-existing eslint errors), then `npm run build` (also runs `prisma generate`).
- `next dev` / `next build` need `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1` or `next/font/google` fails to download Syne/Outfit (`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`). It is in `.env.example`.
