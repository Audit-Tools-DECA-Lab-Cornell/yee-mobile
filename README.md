note because this is in a monorepo had to remove react, react-dom, and react-native-web deps and change metro.config.js a bit.

## Code Quality

Use these scripts to keep code style and quality consistent:

- `bun run typecheck` validates TypeScript types.
- `bun run lint` runs Expo ESLint checks.
- `bun run lint:fix` applies auto-fixable ESLint rules.
- `bun run format` formats files with Prettier.
- `bun run format:check` verifies formatting without changing files.
- `bun run check` runs typecheck, lint, and format checks together.
