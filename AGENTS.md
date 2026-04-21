# Finance Centre Agent Guide

Read [CLAUDE.md](CLAUDE.md) for the full project guide. This file exists as a generic entrypoint for coding agents that look for `AGENTS.md`.

## First Read

- `CLAUDE.md` for stack, structure, and conventions
- `README.md` for product and setup context
- `docs/development.md` for environment and bootstrap details
- `docs/analysis.md` if you are changing the analysis page or API

## Core Rules

- Explore the existing code before editing.
- Match the current patterns in `src/app`, `src/lib`, and Prisma schema usage.
- Validate request inputs with Zod at route boundaries.
- Do not edit `src/generated/prisma/` by hand.
- Keep tests co-located with the implementation.
- Update documentation in the same change when behaviour, routes, setup, env vars, or agent workflows change.

## Common Commands

- `npm run dev`
- `npm test`
- `npm run lint`
- `npx prisma migrate dev --name <name>`
- `npx prisma db seed`
- `npx tsx scripts/set-password.ts <email> <password>`

## Agent Workflow Files

The repository also keeps prompt files in `agents/`:

- `agents/implement.md`
- `agents/test.md`
- `agents/review.md`
- `agents/fix.md`

Those files define the expected handoff between implementation, test, review, and fix passes.
