# Finance Centre

A self-hosted personal finance tracker built with Next.js, TypeScript, Prisma, and PostgreSQL, designed to run on a Raspberry Pi.

## Screenshots

| Dashboard | Transactions |
|:---------:|:------------:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Transactions](docs/screenshots/transactions.png) |

| Debts | Holidays |
|:-----:|:--------:|
| ![Debts](docs/screenshots/debts.png) | ![Holidays](docs/screenshots/holidays.png) |

## Features

**Spending**
- Log expenses with categories, vendors, and line-item breakdowns
- Monthly budgets per category with progress tracking
- Spending summaries by month, year, and week with category breakdowns

**Debts**
- Track credit cards, student loans, personal loans, and other debt products
- Record payments with interest breakdowns
- Balance computed from payment history — never stored

**Savings**
- Goal-based saving with target amounts and dates
- Contribution tracking with notes
- Priority levels (low, medium, high)

**Fixed Costs**
- Housing expenses: rent, council tax, energy, and more — tracked month by month
- Subscriptions with copy-forward to the next month

**Income**
- Gross and net tracking per pay period
- Full deduction breakdown: tax, NI, pension, student loan, and custom deductions

**Holidays**
- Trip-based cost grouping with customisable expense categories
- Per-holiday cost breakdown with date tracking

**Dashboard**
- Separated views: daily spending vs fixed costs vs holidays vs debt & savings
- Monthly net position summary across all areas

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL 17 |
| Auth | NextAuth.js 4 (credentials provider) |
| Charts | Recharts 3 |
| Forms | react-hook-form 7 + Zod 4 |
| Dates | date-fns 4 |
| Process Manager | PM2 |

## Domain Model

The database has 15 entities across 7 areas:

| Area | Entities |
|------|----------|
| Spending | Category, Transaction, TransactionLineItem, Budget |
| Debt | Debt, DebtPayment |
| Savings | SavingsGoal, SavingsContribution |
| Travel | Holiday, HolidayExpense |
| Fixed Costs | HousingExpense, Subscription |
| Income | IncomeSource, IncomeDeduction |
| Config | Settings |

Key design decisions:

- **Single-user app** — no user or account entities; authentication protects a single instance
- **Balances computed via aggregation** — debt balances and savings totals are never stored, always derived from payment/contribution history
- **Snake-case in the database** — all table and column names use `snake_case` via Prisma `@@map`/`@map`, while model fields remain `camelCase`

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 17 (or use the included Docker Compose file)

### Setup

```sh
# Clone the repo
git clone https://github.com/your-username/finance-centre.git
cd finance-centre

# Install dependencies
npm ci

# Start PostgreSQL (if using Docker)
docker compose up -d

# Configure environment
cp .env.example .env
# Edit .env and set:
#   DATABASE_URL=postgresql://finance_centre:finance_centre@localhost:5432/finance_centre?schema=public
#   NEXTAUTH_URL=http://localhost:3000
#   NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Run migrations and seed
npx prisma migrate deploy
npx prisma db seed

# Set your login password
npx tsx scripts/set-password.ts <your-password>

# Start the dev server
npm run dev
```

For production:

```sh
npm run build
npm start
```

## Deployment

This app is designed to run on a Raspberry Pi behind a Cloudflare Tunnel.

- **Runtime:** Node.js 20 on ARM64
- **Process manager:** PM2 to keep the app running across reboots
- **HTTPS:** Cloudflare Tunnel — no ports exposed to the internet. Use `127.0.0.1` (not `localhost`) when configuring the tunnel origin
- **Backups:** Daily `pg_dump` to S3

## Security

- **Authentication:** NextAuth credentials provider with bcrypt-hashed passwords
- **Rate limiting:** Login endpoint limited to 5 attempts per 60 seconds per IP via `rate-limiter-flexible`
- **Security headers:** `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy` — configured in `next.config.ts`
- **No open ports:** Cloudflare Tunnel handles ingress; the server never listens on a public interface
- **CSRF protection:** Provided by NextAuth's built-in CSRF token handling
- **Auth middleware:** All routes require authentication except `/login`

## Project Structure

```
src/
├── app/
│   ├── api/                # REST API routes (CRUD for all entities)
│   │   ├── auth/           #   NextAuth endpoints
│   │   ├── budgets/        #   Budget management
│   │   ├── categories/     #   Category management
│   │   ├── debts/          #   Debts and payments
│   │   ├── holidays/       #   Holidays and expenses
│   │   ├── housing/        #   Housing expenses
│   │   ├── income/         #   Income and deductions
│   │   ├── savings/        #   Savings goals and contributions
│   │   ├── settings/       #   App settings
│   │   ├── subscriptions/  #   Subscriptions with copy-forward
│   │   └── transactions/   #   Transactions, summaries, vendor lookup
│   ├── budgets/            # Budget allocation page
│   ├── debts/              # Debt tracking page
│   ├── fixed-costs/        # Housing & subscriptions page
│   ├── holidays/           # Holiday cost tracking page
│   ├── income/             # Income & deductions page
│   ├── login/              # Login page
│   ├── savings/            # Savings goals page
│   ├── settings/           # Settings page
│   ├── transactions/       # Transaction list & summary pages
│   ├── layout.tsx          # Root layout with nav bar
│   └── page.tsx            # Dashboard
├── lib/
│   ├── auth.ts             # NextAuth configuration
│   ├── auth-rate-limit.ts  # Login rate limiting
│   ├── prisma.ts           # Prisma client singleton
│   ├── validators.ts       # Shared Zod schemas
│   └── months.ts           # Month/date utilities
├── generated/prisma/       # Generated Prisma client (gitignored)
└── middleware.ts            # Auth middleware (protects all routes)
```

## License

MIT
