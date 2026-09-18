# Arcoplay

Gestão de plays (partidas amistosas competitivas) de beach tennis.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + SQLite local / **Turso** em produção
- Auth.js (credentials admin)
- Tailwind CSS

## Setup local

```bash
npm install
cp .env.example .env.local
# edite ADMIN_* e AUTH_SECRET
npx prisma migrate dev
npm run dev
```

Abra http://localhost:3000 — login com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## Deploy (Netlify ou Vercel + Turso)

SQLite em arquivo **não funciona** em serverless. Use Turso (free).

### 1. Criar banco Turso

```bash
# CLI: https://docs.turso.tech/cli/installation
turso auth login
turso db create arcoplay
turso db show arcoplay --url          # → TURSO_DATABASE_URL
turso db tokens create arcoplay       # → TURSO_AUTH_TOKEN
```

### 2. Aplicar schema no Turso

Com as migrations já geradas localmente:

```bash
chmod +x scripts/turso-migrate.sh
TURSO_DB_NAME=arcoplay ./scripts/turso-migrate.sh
```

(Ou manualmente: `turso db shell arcoplay < prisma/migrations/<nome>/migration.sql` na ordem.)

### 3. Subir o código

```bash
git add -A && git commit -m "chore: ready for deploy"
git push   # GitHub
```

### 4a. Netlify

1. [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git  
2. Build: `npm run build` (já no `netlify.toml` + plugin Next)  
3. **Environment variables** (Site settings → Environment):

| Variável | Valor |
|----------|--------|
| `TURSO_DATABASE_URL` | `libsql://....turso.io` |
| `TURSO_AUTH_TOKEN` | token do Turso |
| `DATABASE_URL` | `file:./dev.db` (só pro `prisma generate` no build; runtime usa Turso) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://SEU-SITE.netlify.app` |
| `ADMIN_EMAIL` | seu email |
| `ADMIN_PASSWORD` | sua senha |

4. Deploy → abre a URL → login admin.  
5. Se mudou o domínio, atualize `AUTH_URL` e redeploy.

### 4b. Vercel

1. [vercel.com](https://vercel.com) → Import repo  
2. Mesmas env vars da tabela acima (`AUTH_URL` = `https://SEU-PROJETO.vercel.app`)  
3. Deploy

### Local vs produção

| | Local | Netlify/Vercel |
|--|--------|----------------|
| DB | `DATABASE_URL=file:./dev.db` | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` |
| Client | Prisma padrão | `@prisma/adapter-libsql` |

O switch é automático em `src/lib/db.ts`.
