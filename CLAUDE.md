# Finance Centre

Project guide for AI coding assistants working in this repository.

## What This App Is

Finance Centre is a single-user personal finance application built with Next.js, Prisma, and PostgreSQL. It tracks:

- transactions and categories
- monthly budgets
- debts and payments
- savings goals and contributions
- housing costs and subscriptions
- income and deductions
- holidays and holiday expenses
- dashboard and analysis views over the data

Read [README.md](README.md) first for product and setup context. Use [docs/development.md](docs/development.md) for environment and bootstrap details. Use [docs/analysis.md](docs/analysis.md) when changing analysis calculations or the `/analysis` UI.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 5 strict mode
- Tailwind CSS 4
- Prisma 7 with `@prisma/adapter-pg`
- PostgreSQL 17
- NextAuth.js credentials provider with JWT sessions
- Zod 4
- react-hook-form 7
- Recharts 3
- Vitest 4 and Testing Library

## Project Structure

```text
src/
  app/
    api/                Route handlers for all app domains
    analysis/           Multi-month analytics UI
    budgets/
    debts/
    fixed-costs/
    holidays/
    housing/
    income/
    login/
    savings/
    settings/
    subscriptions/
    transactions/
    layout.tsx
    nav-bar.tsx
    page.tsx            Dashboard
  lib/
    auth.ts
    auth-rate-limit.ts
    months.ts
    prisma.ts
    validators.ts
  generated/prisma/     Generated Prisma client, do not edit
  middleware.ts
prisma/
  schema.prisma
  migrations/
  seed.ts
scripts/
  set-password.ts
agents/
  implement.md
  test.md
  review.md
  fix.md
docs/
  development.md
  analysis.md
```

## Commands

- `npm run dev`
- `npm run build`
- `npm start`
- `npm test`
- `npm run lint`
- `npx prisma migrate dev --name <name>`
- `npx prisma migrate deploy`
- `npx prisma db seed`
- `npx prisma generate`
- `npx tsx scripts/set-password.ts <email> <password>`

## Environment

Required environment variables:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Optional:

- `AUTH_TRUST_PROXY_HEADERS=true` when the app sits behind a trusted reverse proxy and auth rate limiting should respect forwarded IP headers

## Product Surface

Primary routes:

- `/` dashboard
- `/transactions`
- `/transactions/summary`
- `/budgets`
- `/debts`
- `/savings`
- `/housing`
- `/subscriptions`
- `/income`
- `/holidays`
- `/analysis`
- `/settings`
- `/login`

`/settings` manages app settings and categories. Authentication is single-user and backed by the `Settings` row in the database.

## Data Model

Core models:

- `Category`
- `Transaction`
- `TransactionLineItem`
- `Budget`
- `Debt`
- `DebtPayment`
- `SavingsGoal`
- `SavingsContribution`
- `HousingExpense`
- `Subscription`
- `IncomeSource`
- `IncomeDeduction`
- `Holiday`
- `HolidayExpense`
- `Settings`

Important design choices:

- The database uses snake_case via Prisma mapping.
- App code uses camelCase field names.
- Debt and savings totals are derived from history rather than stored as mutable balances.
- The app is single-user. There is no account or multi-tenant layer.

## Conventions

- Read the existing code before making changes. Follow established patterns.
- Prefer Zod validation at API boundaries using schemas in `src/lib/validators.ts`.
- Use Prisma-generated types where they already exist.
- Keep tests next to the implementation as `*.test.ts` or `*.test.tsx`.
- Do not edit `src/generated/prisma/` directly.
- Keep business logic on the server side when it touches persistence or sensitive rules.
- Use small focused components and avoid unnecessary abstraction.

## Auth and Security

- Auth lives in `src/lib/auth.ts`.
- Rate limiting and client IP extraction live in `src/lib/auth-rate-limit.ts`.
- Middleware protects all routes except `/login`, `/api/auth`, and static assets.
- Credentials are stored in the `Settings` table as bcrypt hashes.

## Testing

- Test runner: Vitest with jsdom
- React tests: Testing Library and `@testing-library/user-event`
- Path alias: `@/*` maps to `src/*`
- Run the full suite with `npm test`

## Documentation Discipline

Update docs in the same change when you modify:

- required environment variables
- setup steps or bootstrap scripts
- route names or major UI labels
- seed data expectations
- analysis calculations or API contracts
- agent workflow expectations in `agents/`, `AGENTS.md`, or this file

## Agent Workflow Files

The `agents/` directory defines a four-step implementation workflow:

1. `agents/implement.md`
2. `agents/test.md`
3. `agents/review.md`
4. `agents/fix.md`

Use them as handoff prompts, but keep this file and the human-facing docs in sync with the real codebase.
