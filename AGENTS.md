# AGENTS.md

Guidance for agentic coding tools working in this repository.

## Repository Overview

- Monorepo with npm workspaces: `client/` (Vite + React) and `server/` (Express + Drizzle).
- Root package controls common workspace scripts.
- Database is PostgreSQL, typically started through Docker Compose.
- Server uses ESM JavaScript (`"type": "module"`), with a CommonJS Drizzle config file.

## Workspace Layout

- `client/src/pages` route-level UI.
- `client/src/components` reusable UI pieces.
- `client/src/api` HTTP utilities and endpoint wrappers.
- `client/src/hooks` React Query hooks and query keys.
- `client/src/features` Redux slices.
- `server/src/routes` Express route handlers.
- `server/src/db` Drizzle database client and schema.
- `server/src/lib` domain helpers.
- `server/drizzle` SQL migrations.

## Install and Setup

1. Install dependencies from repo root:
   - `npm install`
2. Start DB service:
   - `npm run db:up`
3. Apply migrations and seed data:
   - `npm run db:migrate`
   - `npm run db:seed`
4. Start apps (separate terminals):
   - `npm run dev:server`
   - `npm run dev:client`

## Build, Lint, Test Commands

### Root

- Client dev server: `npm run dev`
- Client dev server (explicit): `npm run dev:client`
- Server dev server: `npm run dev:server`
- Client production build: `npm run build`
- Client lint: `npm run lint`
- Start server in non-watch mode: `npm run start:server`

### Database

- Start DB container: `npm run db:up`
- Stop DB container: `npm run db:down`
- Generate Drizzle migration artifacts: `npm run db:generate`
- Run migrations: `npm run db:migrate`
- Seed DB: `npm run db:seed`
- Open Drizzle studio: `npm run db:studio`

### Client workspace (`client/`)

- Dev: `npm run dev -w client`
- Build: `npm run build -w client`
- Lint: `npm run lint -w client`
- Preview build: `npm run preview -w client`

### Server workspace (`server/`)

- Dev: `npm run dev -w server`
- Start: `npm run start -w server`
- Build placeholder: `npm run build -w server`

### Tests (current state)

- No automated test runner is currently configured in root/client/server `package.json`.
- No `*.test.*` or `*.spec.*` files are present in the repository.
- Therefore, there is currently **no supported command for "run all tests" or "run a single test"**.
- If you add a test framework, also add scripts for:
  - full run (example naming: `test`)
  - single-file run (example naming: `test:one`)

## Env and Runtime Configuration

- Client env template: `client/.env.example`
- Server env template: `server/.env.example`
- Client reads `VITE_API_URL` from `import.meta.env` (and optional runtime `window.__ENV__`).
- Server requires `DATABASE_URL`; startup fails if missing.
- Default local API port is `4000`; client dev server proxies `/api` to `http://localhost:4000`.

## Code Style and Conventions

These are inferred from the current codebase and should be treated as project standards.

### Language and Modules

- Use JavaScript (ESM) for app code.
- Prefer named exports for reusable utilities/hooks.
- Keep default exports for top-level React components and Express routers where already used.
- Use `.js` for logic and `.jsx` for React components.

### Imports

- Place imports at the top of the file.
- Use third-party imports first, then local imports.
- Use explicit relative paths (no path alias configuration exists).
- Include file extension where this codebase already does (`.js`/`.jsx`) and stay consistent with surrounding file style.

### Formatting

- Follow existing file formatting instead of forcing a new style.
- Client files commonly use semicolons and single quotes.
- Keep lines readable; break long arrays/objects/JSX props across lines.
- Prefer early returns for guard clauses.

### Naming

- React components: `PascalCase` (`ProjectDetails`, `CreateTaskDialog`).
- Hooks: `useX` (`useWorkspaces`, `useCreateProject`).
- Redux slices: `<domain>Slice` (`authSlice`, `themeSlice`).
- Query keys: `<domain>Keys` objects in `queryKeys.js`.
- Server route files: plural resource names (`projects.js`, `tasks.js`).
- DB columns follow existing schema naming (mixed camelCase and snake_case fields); do not mass-rename.

### Types and Data Shapes

- There is no TypeScript; use runtime validation and defensive checks.
- Validate required request fields in route handlers and return `400` with a clear `message`.
- Preserve API response shapes expected by client hooks.
- Use nullable fallbacks explicitly (`|| null`) when fields are optional.

### Error Handling

- Wrap async Express handlers in `try/catch`.
- Forward unexpected errors with `next(error)`.
- Use explicit HTTP statuses for expected failures:
  - `400` for invalid input
  - `401` for unauthenticated
  - `403` for unauthorized
  - `404` for missing resources
- Keep error payload format consistent: `{ message: '...' }`.
- In client API wrappers, throw `Error(message)` for non-OK responses.

### Auth and Permissions

- Protected APIs are behind `requireAuth` middleware in `server/src/index.js`.
- Role logic uses `ADMIN`, `USER`, `CLIENT` patterns.
- Reuse permission helpers from `server/src/lib/permissions.js`.
- Do not bypass workspace/project membership checks in new endpoints.

### Database and Migrations

- Schema source of truth: `server/src/db/schema.js`.
- Use Drizzle query builder (`db.select`, `db.insert`, `db.update`, `db.delete`).
- Generate IDs with `generateId(...)` helper for new entities.
- For schema changes:
  1. edit schema
  2. generate migration
  3. run migration
  4. update dependent server/client code

### Frontend Data Fetching

- Prefer existing React Query hooks in `client/src/hooks`.
- Add query keys in `queryKeys.js` before introducing new queries.
- Invalidate relevant queries in mutation `onSuccess` handlers.
- Keep API calls centralized in `client/src/api/index.js`.

### State Management

- Use Redux slices for auth/theme/workspace-global behavior already in store.
- Keep local UI state in components when global access is not needed.
- Persist auth-related data in localStorage only via auth slice utilities.

## Linting Rules to Respect

- ESLint is configured in `client/eslint.config.js`.
- Active `no-unused-vars` enforcement allows ignore pattern `^[A-Z_]`.
- `react-hooks` and `react-refresh` recommended configs are active.
- There is no server ESLint config yet; mirror the prevailing server style when editing backend files.

## Cursor/Copilot Rule Files

- No `.cursorrules` file was found.
- No `.cursor/rules/` directory was found.
- No `.github/copilot-instructions.md` file was found.
- If these files are added later, treat them as higher-priority agent instructions.

## Agent Working Agreement

- Make minimal, targeted changes.
- Do not introduce new frameworks or major patterns without clear need.
- Avoid broad refactors unless requested.
- Update docs/scripts when behavior or setup changes.
- When adding tests in the future, include single-test execution docs in this file.
