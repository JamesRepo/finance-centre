# Finance Centre

Personal finance tracking application for managing transactions, budgets, and spending categories.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **React:** 19
- **Database:** PostgreSQL 17 via Prisma 7 with `@prisma/adapter-pg`
- **Styling:** Tailwind CSS 4 (PostCSS plugin)
- **Validation:** Zod 4
- **Forms:** React Hook Form 7
- **Charts:** Recharts 3
- **Dates:** date-fns 4

## Project Structure

```
src/
  app/              # Next.js App Router pages and layouts
  generated/prisma/ # Prisma-generated client (do NOT edit)
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script (default categories)
  migrations/       # Prisma migrations
agents/             # Agent workflow prompts (implement, test, review)
```

## Getting Started

```sh
docker compose up -d                        # Start PostgreSQL
cp .env .env.local                          # Copy env if needed
npm install
npx prisma migrate dev                      # Run migrations
npx prisma db seed                          # Seed default categories
npm run dev                                 # Start dev server
```

## Key Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — ESLint (flat config, next/core-web-vitals + next/typescript)
- `npx prisma migrate dev --name <name>` — Create a migration
- `npx prisma db seed` — Seed the database
- `npx prisma generate` — Regenerate Prisma client

## Database

- PostgreSQL 17, run via `docker-compose.yml`
- Connection: `postgresql://finance_centre:finance_centre@localhost:5432/finance_centre?schema=public`
- Prisma client is generated to `src/generated/prisma/` — this directory is gitignored
- Prisma uses `@prisma/adapter-pg` (node-pg driver adapter), not the default binary engine
- Schema uses `@@map` for snake_case table/column names with camelCase model fields

### Models

- **Category** — spending categories (name, colorCode, isSystem)
- **Transaction** — individual transactions (amount, date, description, vendor, categoryId)
- **Budget** — monthly budget per category (amount, month, categoryId; unique on [categoryId, month])

## Conventions

- **Path alias:** `@/*` maps to `./src/*`
- **Fonts:** Geist Sans and Geist Mono via `next/font/google`
- **Styling:** Tailwind utility classes directly in JSX; no CSS modules or styled-components
- **Validation:** Zod schemas at API/form boundaries; co-locate schemas near usage
- **Types:** Use Prisma-generated types. Only create additional types when Prisma types don't cover the need
- **Server logic:** Keep business logic in server-side code (Server Actions / Route Handlers)
- **Components:** Small, focused components. No speculative abstractions
- **No over-engineering:** Only build what is required. No unnecessary configurability or premature abstraction

## Agent Workflows

The `agents/` directory contains prompts for a multi-stage workflow:

1. **`agents/implement.md`** — Feature implementation (no tests)
2. **`agents/test.md`** — QA test writing (Vitest preferred)
3. **`agents/review.md`** — Code review (approve/reject)
4. **`agents/fix.md`** — Fix rejected review (apply fixes, update tests, resubmit)

If a review is **rejected**, run `agents/fix.md` in the same conversation. The fix agent reads the review output from context, addresses all issues, updates tests, and produces a summary for re-review.

When implementing features, follow the implement agent's instructions: explore existing code first, match existing patterns, validate with Zod at boundaries, and provide a summary checklist when done.
