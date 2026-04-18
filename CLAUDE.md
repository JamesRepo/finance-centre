# Finance Centre

Personal finance tracking application for managing transactions, budgets, spending categories, debts, savings, income, holidays, and fixed costs.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5 (strict mode)
- **React:** 19
- **Database:** PostgreSQL 17 via Prisma 7 with `@prisma/adapter-pg`
- **Auth:** NextAuth.js 4 (Credentials provider, JWT sessions, bcrypt)
- **Styling:** Tailwind CSS 4 (PostCSS plugin, no separate config file)
- **Validation:** Zod 4 with `@hookform/resolvers`
- **Forms:** React Hook Form 7
- **Charts:** Recharts 3
- **Dates:** date-fns 4
- **Testing:** Vitest 4 with Testing Library (React, jest-dom, user-event) and jsdom
- **Rate Limiting:** rate-limiter-flexible (login attempts)

## Project Structure

```
src/
  app/              # Next.js App Router pages, layouts, and API routes
    api/            # REST API route handlers (budgets, categories, debts, etc.)
  lib/              # Shared utilities (auth, prisma client, validators, month helpers)
  middleware.ts     # Auth middleware (protects all routes except /login, /api/auth)
  generated/prisma/ # Prisma-generated client (do NOT edit, gitignored)
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script (default categories)
  migrations/       # Prisma migrations
scripts/
  set-password.ts   # Initial password setup script
agents/             # Agent workflow prompts (implement, test, review, fix)
```

## Key Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run test` — Run tests (Vitest)
- `npm run lint` — ESLint (flat config, next/core-web-vitals + next/typescript)
- `npx prisma migrate dev --name <name>` — Create a migration
- `npx prisma db seed` — Seed the database
- `npx prisma generate` — Regenerate Prisma client (also runs on `npm install` via postinstall)

## Pages

- `/` — Dashboard
- `/transactions` — Transaction list and entry
- `/transactions/summary` — Transaction summary/analytics
- `/budgets` — Monthly budget allocation
- `/fixed-costs` — Combined housing & subscriptions view
- `/housing` — Housing expenses
- `/subscriptions` — Subscription tracking
- `/debts` — Debt tracking
- `/savings` — Savings goals
- `/income` — Income sources & deductions
- `/holidays` — Holiday cost tracking
- `/settings` — App settings (currency, locale, budget total, password)
- `/login` — Authentication (unauthenticated route)

## Database

- PostgreSQL 17, run via `docker-compose.yml`
- Connection: `postgresql://finance_centre:finance_centre@localhost:5432/finance_centre?schema=public`
- Prisma client is generated to `src/generated/prisma/` — this directory is gitignored
- Prisma uses `@prisma/adapter-pg` (node-pg driver adapter), not the default binary engine
- Schema uses `@@map` for snake_case table/column names with camelCase model fields

### Models

- **Category** — spending categories (name, colorCode, isSystem, showOnDashboardDailySpending)
- **Transaction** — individual transactions (amount, transactionDate, description, vendor, categoryId)
- **TransactionLineItem** — line items within a transaction (amount, sortOrder; cascade delete)
- **Budget** — monthly budget per category (amount, month, categoryId; unique on [categoryId, month])
- **Debt** — debt accounts (name, debtType, originalBalance, interestRate, minimumPayment, isActive)
- **DebtPayment** — payments against debts (amount, interestAmount, paymentDate; cascade delete)
- **SavingsGoal** — savings targets (name, targetAmount, targetDate, priority)
- **SavingsContribution** — contributions to savings goals (amount, contributionDate; cascade delete)
- **HousingExpense** — housing costs (expenseType, amount, expenseMonth, frequency; unique on [expenseType, expenseMonth])
- **Subscription** — recurring subscriptions (name, amount, frequency, paymentDate, paymentMonth; unique on [name, paymentMonth])
- **IncomeSource** — income entries (incomeType, grossAmount, netAmount, incomeDate, isRecurring, isActive)
- **IncomeDeduction** — deductions from income (deductionType, name, amount, isPercentage; cascade delete)
- **Holiday** — holiday trips (name, destination, assignedMonth, startDate, endDate, isActive)
- **HolidayExpense** — expenses within a holiday (expenseType, description, amount, expenseDate; cascade delete)
- **Settings** — app configuration (currency, locale, monthlyBudgetTotal, email, passwordHash; single row)

### Enums

- **DebtType** — CREDIT_CARD, STUDENT_LOAN, PERSONAL_LOAN, OTHER
- **SavingsPriority** — LOW, MEDIUM, HIGH

## Authentication

- Single-user model: credentials stored in the Settings table (email + bcrypt passwordHash)
- NextAuth.js 4 with Credentials provider and JWT strategy (7-day session max age)
- Auth config in `src/lib/auth.ts`, rate limiting in `src/lib/auth-rate-limit.ts` (5 attempts/60s per IP)
- Middleware (`src/middleware.ts`) protects all routes except `/login`, `/api/auth`, static files
- Environment variables: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`

## Testing

- Vitest 4 with jsdom environment
- Config: `vitest.config.ts` (path alias `@` → `./src`, globals enabled)
- Setup: `vitest.setup.ts` (imports `@testing-library/jest-dom/vitest`, auto-cleanup)
- Tests co-located with source files as `*.test.ts` / `*.test.tsx`
- Libraries: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`

## Security

- Next.js security headers configured in `next.config.ts`:
  - X-Content-Type-Options, X-Frame-Options (DENY), X-XSS-Protection
  - Strict Referrer-Policy, Content-Security-Policy, Permissions-Policy
- Login rate limiting (5 attempts per 60 seconds per IP)
- bcrypt password hashing

## Conventions

- **Path alias:** `@/*` maps to `./src/*`
- **Fonts:** Geist Sans and Geist Mono via `next/font/google`
- **Styling:** Tailwind utility classes directly in JSX; no CSS modules, styled-components, or UI component library
- **Validation:** Zod schemas in `src/lib/validators.ts`; co-locate additional schemas near usage
- **Types:** Use Prisma-generated types. Only create additional types when Prisma types don't cover the need
- **Server logic:** Keep business logic in server-side code (Server Actions / Route Handlers)
- **Components:** Small, focused components co-located with pages. No formal `components/` directory
- **No over-engineering:** Only build what is required. No unnecessary configurability or premature abstraction
- **ESLint custom rules:** consistent-type-imports (inline), no-unused-vars (allow `_` prefix), no-explicit-any (warn), no-console (warn, allow warn/error), eqeqeq (error), curly (multi-line), no-throw-literal, prefer-const

## Agent Workflows

The `agents/` directory contains prompts for a multi-stage workflow:

1. **`agents/implement.md`** — Feature implementation (no tests)
2. **`agents/test.md`** — QA test writing (Vitest preferred)
3. **`agents/review.md`** — Code review (approve/reject)
4. **`agents/fix.md`** — Fix rejected review (apply fixes, update tests, resubmit)

If a review is **rejected**, run `agents/fix.md` in the same conversation. The fix agent reads the review output from context, addresses all issues, updates tests, and produces a summary for re-review.

When implementing features, follow the implement agent's instructions: explore existing code first, match existing patterns, validate with Zod at boundaries, and provide a summary checklist when done.
