# Finance Centre

Self-hosted personal finance tracking for a single household. The app covers day-to-day spending, monthly budgeting, debts, savings, holidays, fixed costs, income, and higher-level analysis.

## Screenshots

| Dashboard | Transactions |
| :-------: | :----------: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Transactions](docs/screenshots/transactions.png) |

| Debts | Holidays |
| :---: | :------: |
| ![Debts](docs/screenshots/debts.png) | ![Holidays](docs/screenshots/holidays.png) |

## What It Covers

- Spending transactions with optional line-item breakdowns
- Monthly budgets by category
- Transaction summaries by month, year, and week
- Debt tracking with payment and interest history
- Savings goals with contribution history
- Housing expenses and recurring subscriptions
- Income sources with deduction breakdowns
- Holiday planning and holiday-specific expenses
- Dashboard views for daily spend, fixed costs, debt, savings, and holidays
- Analysis views for spending trends, budget health, income vs outgoings, and net worth
- Settings for locale, currency, monthly budget total, and category maintenance

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 5 in strict mode
- Prisma 7 with `@prisma/adapter-pg`
- PostgreSQL 17
- NextAuth.js credentials auth
- Zod 4 and react-hook-form 7
- Tailwind CSS 4
- Recharts 3
- Vitest 4 and Testing Library

## Quick Start

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 17
- Docker Desktop or another Docker runtime if you want to use the bundled database container

### Setup

```sh
npm ci
cp .env.example .env
docker compose up -d
```

Set the auth values in `.env` before starting the app:

```env
DATABASE_URL="postgresql://finance_centre:finance_centre@localhost:5432/finance_centre?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-random-secret"
# Optional: trust x-forwarded-for / x-real-ip headers in front of a reverse proxy
# AUTH_TRUST_PROXY_HEADERS="true"
```

Then initialise the database and login credentials:

```sh
npx prisma migrate deploy
npx prisma db seed
npx tsx scripts/set-password.ts you@example.com your-password
npm run dev
```

Open `http://localhost:3000/login` and sign in with the email and password you set above.

## Common Commands

- `npm run dev` starts the development server
- `npm run build` creates a production build
- `npm start` runs the production server
- `npm test` runs the Vitest suite
- `npm run lint` runs ESLint
- `npx prisma migrate dev --name <name>` creates a new migration during development
- `npx prisma db seed` reloads the sample data

## Routes

- `/` dashboard
- `/transactions` transaction entry and list
- `/transactions/summary` spending summaries
- `/budgets` monthly budgets
- `/debts` debt tracking
- `/savings` savings goals
- `/housing` housing expenses
- `/subscriptions` recurring subscriptions
- `/income` income and deductions
- `/holidays` holiday planning and expenses
- `/analysis` trend and net worth analysis
- `/settings` app settings and category management
- `/login` sign-in page

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma, seeding, and the password setup script |
| `NEXTAUTH_URL` | Yes | Base URL for NextAuth callbacks and local sign-in flows |
| `NEXTAUTH_SECRET` | Yes | Secret used to sign NextAuth JWT sessions |
| `AUTH_TRUST_PROXY_HEADERS` | No | Enables `x-forwarded-for` and `x-real-ip` handling for auth rate limiting when the app sits behind a trusted proxy |

## Data Model

The schema currently covers these core models:

- Spending: `Category`, `Transaction`, `TransactionLineItem`, `Budget`
- Debt: `Debt`, `DebtPayment`
- Savings: `SavingsGoal`, `SavingsContribution`
- Fixed costs: `HousingExpense`, `Subscription`
- Income: `IncomeSource`, `IncomeDeduction`
- Holidays: `Holiday`, `HolidayExpense`
- App config: `Settings`

Design constraints worth knowing:

- Single-user app with credentials stored in the `Settings` row
- Balances are derived where possible instead of being persisted redundantly
- Database tables and columns use snake_case via Prisma mapping

## Project Layout

```text
src/
  app/
    api/              Route handlers for the app data model
    analysis/         Analysis UI tabs and page
    login/            Sign-in page
    page.tsx          Dashboard
  lib/
    auth.ts           NextAuth configuration
    auth-rate-limit.ts Login throttling and client IP extraction
    months.ts         Month helpers used across dashboard and analysis
    prisma.ts         Prisma client singleton
    validators.ts     Shared Zod schemas
prisma/
  schema.prisma       Database schema
  migrations/         Prisma migrations
  seed.ts             Seed data for categories and sample finance records
scripts/
  set-password.ts     Writes email and password hash into Settings
agents/
  implement.md
  test.md
  review.md
  fix.md
docs/
  development.md      Setup, environment, and operational notes
  analysis.md         Analysis feature and API contract
```

## Self-Hosting Notes

The repository is built for self-hosting and works well on small home-server hardware, including a Raspberry Pi. Deployment infrastructure is intentionally not hard-coded in the app, so you need to choose your own process manager, TLS/ingress setup, backups, and secret management.

## More Docs

- [Development guide](docs/development.md)
- [Analysis guide](docs/analysis.md)
- [AI workflow guide](CLAUDE.md)
- [Generic agent entrypoint](AGENTS.md)
