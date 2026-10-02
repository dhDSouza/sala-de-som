# Repository Guidelines

## Project Structure & Module Organization

This is a full-stack Next.js App Router application. Pages and layouts live in `src/app/`; HTTP handlers are under `src/app/api/**/route.ts`. Reusable UI belongs in `src/components/`, while authentication, access control, and service integrations belong in `src/lib/`. TypeORM entities, the data source, and timestamped migrations are in `src/db/`. Global styles are in `src/app/globals.css`.

Use the `@/*` alias for imports rooted at `src` when it makes dependencies clearer. Keep route-specific logic near its route and shared behavior in `src/lib`.

## Build, Test, and Development Commands

- `npm ci`: install the exact dependency versions in `package-lock.json`.
- `docker compose up -d postgres`: start the local PostgreSQL 16 service.
- `npm run db:migrate`: load `.env.local` and run TypeORM migrations using `src/db/data-source.ts`.
- `npm run db:compile`: compile migrations to `dist-db/` for deployment.
- `npm run db:migrate:prod`: run compiled migrations with `DATABASE_URL` supplied by the host.
- `npm run dev`: start the development server at `http://localhost:3000`.
- `npm run build`: create a production build.
- `npm start`: serve the completed production build.
- `npm run typecheck`: run strict TypeScript checks without emitting files.
- `npm run lint`: check ESLint, Next.js, and Prettier rules.
- `npm run format`: format supported source and configuration files.

## Coding Style & Naming Conventions

Follow `.prettierrc`: tabs (width 4), single quotes, no semicolons, trailing commas, LF endings, and a 120-character line limit. ESLint enforces statement spacing. Use `PascalCase` for React components and types, `camelCase` for variables/functions, and descriptive lowercase route directories. Add `'use client'` only when browser APIs or client hooks require it.

## Testing Guidelines

No automated test framework or coverage threshold is configured yet. Before every change, run `npm run lint`, `npm run typecheck`, and `npm run build`. Manually exercise affected API routes and the relevant dashboard flows. If adding tests, colocate them as `*.test.ts` or `*.test.tsx` and add the runner command to `package.json`.

## Commit & Pull Request Guidelines

Git history is not included in this checkout, so no repository-specific convention can be inferred. Use short, imperative commit subjects such as `Fix class voting authorization`. Keep commits focused. Pull requests should explain the user-visible change, configuration or migration steps, and verification performed; link related issues and include screenshots for UI changes.

## Security & Configuration

Never commit `.env.local`, OAuth secrets, SMTP credentials, or session keys. Password registration requires SMTP verification; existing password login needs `DATABASE_URL` and `SESSION_SECRET`. Set `APP_URL` to the HTTPS deployment URL. Configure `AUTH_IP_HEADER` only behind a trusted proxy that overwrites it. Google OAuth credentials and `BOOTSTRAP_ADMIN_EMAIL` are only needed for Google sign-in and initial admin bootstrapping. YouTube links are parsed locally; no YouTube Data API key is required.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
