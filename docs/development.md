# Development Guide

This document covers the parts of local development that are easy to get wrong: environment setup, database bootstrap, auth bootstrap, and the conventions that keep the repository coherent.

## Prerequisites

- Node.js 20+
- PostgreSQL 17
- `npm`
- Docker if you want to run the bundled database container

## Local Setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL with `docker compose up -d` if you are using the bundled container.
4. Set `NEXTAUTH_URL` and `NEXTAUTH_SECRET` in `.env`.
5. Apply migrations with `npx prisma migrate deploy`.
6. Seed sample data with `npx prisma db seed`.
7. Set login credentials with `npx tsx scripts/set-password.ts you@example.com your-password`.
8. Start the app with `npm run dev`.

## Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Shared by Prisma, the seed script, and `scripts/set-password.ts` |
| `NEXTAUTH_URL` | Yes | Usually `http://localhost:3000` in local development |
| `NEXTAUTH_SECRET` | Yes | Use a long random string; `openssl rand -base64 32` is sufficient |
| `AUTH_TRUST_PROXY_HEADERS` | No | Set to `true` only when the app runs behind a trusted reverse proxy and you want auth rate limiting to read forwarded IP headers |

## Seed Data

`prisma/seed.ts` is not limited to categories. It also creates representative sample data for budgets, transactions, debts, savings, holidays, housing, subscriptions, and income so the dashboard and analysis pages have meaningful charts immediately after setup.

That makes seeding useful for local development, but it also means the seeded database is demo-style data rather than a minimal empty state.

## Authentication Bootstrap

Authentication is single-user and backed by the `Settings` table.

- The normal first-time bootstrap path is `scripts/set-password.ts`.
- `GET /api/settings` will create an empty settings row if one does not exist yet, but the settings route still sits behind auth.
- `scripts/set-password.ts` writes both the login email and the bcrypt password hash.
- The script usage is `npx tsx scripts/set-password.ts <email> <password>`.
- Without both `NEXTAUTH_SECRET` and stored credentials, sign-in will fail.

## Database Notes

- Prisma client output is generated into `src/generated/prisma/`.
- That generated directory should not be edited by hand.
- The schema uses Prisma `@map` and `@@map` to keep the database in snake_case while application code stays camelCase.
- Several aggregates rely on historical records rather than stored balances, especially for debt and savings.

## Testing and CI

- `npm test` runs the Vitest suite.
- `npm run lint` runs the flat ESLint config.
- Tests are co-located as `*.test.ts` and `*.test.tsx`.
- GitHub Actions runs the test suite nightly in `.github/workflows/nightly-tests.yml`.

## Documentation Expectations

Update docs in the same change when you alter any of the following:

- setup steps or required environment variables
- route structure or major page labels
- seed behaviour that affects first-run expectations
- analysis calculations or API contracts
- agent workflow expectations in `agents/`, `AGENTS.md`, or `CLAUDE.md`

## Common Pitfalls

- If login rate limiting cannot determine an IP address, it logs a skipped-rate-limit warning instead of blocking auth. That is expected on some local setups.
- If `npm run dev` warns about multiple lockfiles in parent directories, keep the configured Turbopack root pointed at this repository so module resolution stays inside `finance-centre`.
- If you change Prisma schema or generator settings, run `npx prisma generate`.
- If the UI looks empty after setup, verify that seeding ran successfully and that you are viewing the current month.
