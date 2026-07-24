# Technology Stack

**Analysis Date:** 2026-07-24

## Languages

**Primary:**
- TypeScript 5 - All source code in `packages/core/src/` and `apps/web/src/`

**Secondary:**
- JavaScript (ESM) - Configuration files (`.mjs` and `.ts` for ESM exports)

## Runtime

**Environment:**
- Node.js (via Vercel) - Edge runtime for OG image generation, standard runtime for API routes and ISR builds

**Package Manager:**
- npm (Yarn workspaces in monorepo root at `package.json`)
- Lockfile: Present (package-lock.json expected but not viewed)

## Frameworks

**Core:**
- Next.js 16.2.4 (App Router) - Primary framework in `apps/web/`
  - OG image generation via `next/og` (edge runtime)
  - ISR with revalidation tags in `apps/web/src/app/`
  - API routes at `apps/web/src/app/api/og/route.tsx`
- React 19.2.4 - UI component layer
- @notionhq/client 5.20.0 - Official Notion SDK wrapper in `packages/core/src/client.ts`

**Build/Dev:**
- tsup 8.0.0 - Bundles `packages/core/src/` to CJS + ESM with types
- TypeScript 5 - Compilation with strict mode enabled
- ESLint 9 - Linting via `eslint-config-next` (Web Vitals + TypeScript rules)
- Tailwind CSS 4 - Styling engine with PostCSS integration

**Testing:**
- Not detected in package.json dependencies

## Key Dependencies

**Critical:**
- `@4lph4/nolog-core` 1.0.1 - Published SDK wrapper for Notion queries (internal monorepo package)
  - Exports `NologClient`, `mapPageToPost`, `Post` type
  - Consumed by `apps/web/src/lib/notion.ts`
- `@notionhq/client` 5.20.0 - Official Notion API client
  - Used in `packages/core/src/client.ts` for database queries and block retrieval
- `react-notion-x` 7.10.0 - Renders Notion blocks (callouts, tables, toggles, code, embeds)
  - Notion type definitions: `notion-client` 7.10.0, `notion-types` 7.10.0, `notion-utils` 7.10.0

**UI & Theming:**
- `next-themes` 0.4.6 - Dark/light mode toggle with class-based switching in `apps/web/src/components/ThemeProvider.tsx`
- `lucide-react` 1.14.0 - Icon library
- `tailwindcss` 4 - CSS framework via `@tailwindcss/postcss` 4

**Rendering & Syntax:**
- `mermaid` 11.15.0 - Diagram rendering in Notion code blocks via `apps/web/src/components/notion/MermaidBlock.tsx`
- `shiki` 4.0.2 - Syntax highlighting for code blocks
- `date-fns` 4.1.0 - Date formatting utility

**Babel & Polyfills:**
- `@babel/runtime` 7.29.2 - Runtime utilities for transforms

**Vercel Integration:**
- `@vercel/analytics` 2.0.1 - Web Analytics in `apps/web/src/app/layout.tsx`
- `@vercel/og` 0.11.1 - OG image generation (alternative to `next/og`)

**Dev Tools:**
- `@types/node` 20 - Node.js type definitions
- `@types/react` 19 - React type definitions
- `@types/react-dom` 19 - React DOM type definitions
- `@types/uuid` 10.0.0 - UUID type definitions (imported but usage not verified)

## Configuration

**TypeScript:**
- `apps/web/tsconfig.json` - ES2017 target, strict mode, JSX React 17+, moduleResolution bundler
- `packages/core/tsconfig.json` - ES2022 target, CommonJS module, strict mode, declaration output to `dist/`

**Next.js:**
- `apps/web/next.config.ts` - Remote image patterns for AWS S3 (Notion file assets)
  - `s3.us-west-2.amazonaws.com` - Notion public asset CDN
  - `prod-files-secure.s3.us-west-2.amazonaws.com` - Notion secure file storage

**CSS & Build:**
- `apps/web/postcss.config.mjs` - Tailwind CSS v4 via `@tailwindcss/postcss` plugin
- `apps/web/src/app/globals.css` - CSS custom properties (light/dark mode color tokens)
  - Light mode: white backgrounds, Notion blue accent (#2383e2)
  - Dark mode: defined via CSS variables
  - Terminal mode: specific semantic colors (emerald prompt, blue accent)

**Linting:**
- `apps/web/eslint.config.mjs` - Flat config with `eslint-config-next/core-web-vitals` + TypeScript
  - Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

## Environment Configuration

**Required environment variables:**
- `NOTION_TOKEN` - Notion integration secret (stored as env var)
- `NOTION_DATABASE_ID` - UUID of Notion database with posts

**Optional environment variables:**
- `NEXT_PUBLIC_CUSDIS_APP_ID` - Public Cusdis app ID (comments feature gated on this)

**ISR Configuration:**
- `CONFIG.revalidate` = 180 seconds (3 minutes) in `apps/web/src/site.config.ts`
- Cache tag: `"notion-posts"` for on-demand revalidation
- Fetch options passed to Next.js ISR: `next: { revalidate, tags }`

## Platform Requirements

**Development:**
- Node.js (version not pinned; inferred LTS based on Next.js 16 compatibility)
- npm (workspaces enabled)

**Production:**
- Vercel (deployment platform with edge runtime support)
- Notion workspace with integration created at notion.so/my-integrations
- GitHub repository (source for Vercel auto-deployment)

---

*Stack analysis: 2026-07-24*
