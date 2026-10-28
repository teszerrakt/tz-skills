## Delivery

- **Tracks:** frontend `src/features/`
- **Typecheck:** `pnpm typecheck`
- **Lint:** `pnpm lint`
- **Tests:** `pnpm test`

### Parallel runs

- **Max sessions:** 1
- **Dev server ports:** `VITE_PORT`, 5174–5179
- **Concurrency pin:** `--concurrency=2`
- **Ask:** `bun ~/.claude/ship-ui/ship-ui.ts ask`
- **Status:** `bun ~/.claude/ship-ui/ship-ui.ts status`
- **Run context:** `bun ~/.claude/ship-ui/ship-ui.ts run --file <json>`
- **Finding:** `bun ~/.claude/ship-ui/ship-ui.ts finding`
