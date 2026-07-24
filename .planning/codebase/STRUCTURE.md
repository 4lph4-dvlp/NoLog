# Codebase Structure

**Analysis Date:** 2026-07-24

## Directory Layout

```
nolog-monorepo/
├── apps/
│   └── web/                         # Next.js frontend app
│       ├── src/
│       │   ├── app/                 # Next.js App Router pages
│       │   │   ├── layout.tsx        # Root layout, template routing
│       │   │   ├── page.tsx          # Home (post list)
│       │   │   ├── post/
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx  # Individual post page
│       │   │   ├── category/
│       │   │   │   └── [slug]/
│       │   │   │       └── page.tsx  # Posts filtered by category
│       │   │   ├── search/
│       │   │   │   └── page.tsx      # Search results page
│       │   │   ├── api/
│       │   │   │   └── og/
│       │   │   │       └── route.tsx # OG image generator (Edge runtime)
│       │   │   ├── sitemap.ts        # Dynamic sitemap.xml generator
│       │   │   ├── robots.ts         # Dynamic robots.txt generator
│       │   │   ├── globals.css       # Global Tailwind CSS
│       │   │   └── layout.tsx        # Root layout wrapper
│       │   ├── components/           # Shared UI components
│       │   │   ├── Profile.tsx       # Author profile sidebar
│       │   │   ├── SearchBar.tsx     # Search input + navigation
│       │   │   ├── CategoryList.tsx  # Category pill list
│       │   │   ├── ThemeProvider.tsx # next-themes wrapper
│       │   │   ├── ThemeToggle.tsx   # Dark mode toggle button
│       │   │   ├── comments/
│       │   │   │   └── CommentSection.tsx # Comment widget
│       │   │   └── notion/           # Notion rendering components
│       │   │       ├── NotionPageRenderer.tsx # react-notion-x wrapper
│       │   │       ├── NotionCode.tsx # Custom code block (Mermaid + syntax)
│       │   │       └── MermaidBlock.tsx # Mermaid diagram renderer
│       │   ├── templates/            # Visual template variants
│       │   │   ├── default/          # Default marketing template
│       │   │   │   ├── Layout.tsx    # 3-column grid layout
│       │   │   │   ├── HomePage.tsx  # Post card list
│       │   │   │   ├── PostPage.tsx  # Article with sidebar
│       │   │   │   ├── CategoryPage.tsx
│       │   │   │   └── SearchPage.tsx
│       │   │   └── terminal/         # Terminal CLI emulation
│       │   │       ├── Layout.tsx    # Full-screen console
│       │   │       ├── HomePage.tsx  # Terminal home
│       │   │       ├── PostPage.tsx  # Terminal post view
│       │   │       ├── CategoryPage.tsx
│       │   │       ├── SearchPage.tsx
│       │   │       └── components/
│       │   │           └── TerminalConsole.tsx # Terminal UI logic
│       │   ├── lib/                  # Server-side utilities
│       │   │   ├── notion.ts         # Data loaders (getPosts, getPost, etc.)
│       │   │   └── notion-x.ts       # notion-client wrapper for page rendering
│       │   ├── types/
│       │   │   └── index.ts          # Post interface (mirrors core types)
│       │   ├── site.config.ts        # Site config: template, profile, SEO
│       │   └── public/               # Static assets
│       │       └── avatar.png
│       ├── package.json              # Dependencies: next, react, notion-client, etc.
│       ├── tsconfig.json             # Path alias: @/* → ./src/*
│       └── .env.local.example        # Template for env vars
│
├── packages/
│   └── core/                         # Shared Notion SDK package
│       ├── src/
│       │   ├── client.ts             # NologClient class (main Notion interface)
│       │   ├── types.ts              # Post interface definition
│       │   └── index.ts              # Barrel export
│       ├── package.json              # name: @4lph4/nolog-core
│       └── tsconfig.json
│
├── package.json                      # Root monorepo (yarn workspaces)
├── CLAUDE.md                         # Project instructions
└── .planning/
    └── codebase/                     # Codebase documentation (this file)
        ├── ARCHITECTURE.md
        ├── STRUCTURE.md
        ├── CONVENTIONS.md (if written)
        ├── TESTING.md (if written)
        ├── STACK.md (if written)
        ├── INTEGRATIONS.md (if written)
        └── CONCERNS.md (if written)
```

## Directory Purposes

**`apps/web/src/app/`:**
- Purpose: Next.js App Router pages (each file maps to a route)
- Contains: Page components (TSX) and API routes
- Key files:
  - `page.tsx`: Homepage route (/)
  - `post/[id]/page.tsx`: Dynamic post routes (/post/{postId})
  - `category/[slug]/page.tsx`: Category filter routes (/category/{slug})
  - `search/page.tsx`: Search results (/search?q={query})
  - `api/og/route.tsx`: Social media image generation endpoint
  - `layout.tsx`: Root wrapper, template router, categories fetcher
  - `sitemap.ts`: Dynamic XML sitemap for SEO
  - `robots.ts`: Dynamic robots.txt based on CONFIG.seo.allowIndexing

**`apps/web/src/components/`:**
- Purpose: Reusable UI components shared across pages
- Contains: Stateless presentational components and client components for interactivity
- Key subdirectories:
  - `notion/`: react-notion-x rendering wrappers (NotionPageRenderer, NotionCode, MermaidBlock)
  - `comments/`: Comment widget integration (currently placeholder)
  - Root level: Profile sidebar, SearchBar, CategoryList, ThemeProvider, ThemeToggle

**`apps/web/src/templates/`:**
- Purpose: Visual template variants (default marketing vs. terminal CLI)
- Contains: Two parallel template implementations
- Structure:
  - `default/`: 3-column responsive grid (categories, feed, profile)
  - `terminal/`: Full-screen terminal console emulation
  - Each has: Layout, HomePage, PostPage, CategoryPage, SearchPage
- Routing: `apps/web/src/app/layout.tsx` selects template based on CONFIG.template

**`apps/web/src/lib/`:**
- Purpose: Server-side utility functions (data loaders, API wrappers)
- Contains:
  - `notion.ts`: React cache() wrapped data loaders (getPosts, getPost, getCategories, getBlocks) with ISR config
  - `notion-x.ts`: notion-client wrapper for fetching full page content (recordMap)
  - No public route handlers here; these are server-only functions

**`packages/core/src/`:**
- Purpose: Shared Notion SDK (monorepo package)
- Contains:
  - `client.ts`: NologClient class with REST API queries, property extractors, mapPageToPost function
  - `types.ts`: Post interface (source of truth for post schema)
  - `index.ts`: Barrel export (re-exports types and client)
- Build: tsup compiles to `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts`
- Published as: `@4lph4/nolog-core` (internal monorepo dependency)

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx`: Root layout that routes to template layout and fetches categories at page build time
- `apps/web/src/app/page.tsx`: Homepage entry point
- `apps/web/src/app/post/[id]/page.tsx`: Post detail page entry point

**Configuration:**
- `apps/web/src/site.config.ts`: Site metadata (title, URL, profile, SNS, template choice, ISR revalidation)
- `.env.local` (not committed): Notion token and database ID
- `apps/web/tsconfig.json`: Path alias configuration (@/* → ./src/*)

**Core Logic:**
- `packages/core/src/client.ts`: NologClient class with Notion API interaction
- `apps/web/src/lib/notion.ts`: Data loader wrappers with React cache() and ISR config

**Content Rendering:**
- `apps/web/src/components/notion/NotionPageRenderer.tsx`: react-notion-x wrapper (client component)
- `apps/web/src/components/notion/NotionCode.tsx`: Custom code block handler (Mermaid detection)
- `apps/web/src/templates/default|terminal/PostPage.tsx`: Post page layout

**Testing:**
- No test files found in current codebase
- Future tests would live in `apps/web/src/**/*.test.tsx` (vitest pattern) or `packages/core/src/**/*.test.ts`

## Naming Conventions

**Files:**
- Page routes: `page.tsx` (Next.js convention)
- API routes: `route.tsx` (Next.js convention)
- Components: `PascalCase.tsx` (e.g., `Profile.tsx`, `NotionPageRenderer.tsx`)
- Utilities/functions: `camelCase.ts` (e.g., `notion.ts`, `site.config.ts`)
- Types: Exported as `interface Post` in `types.ts` files

**Directories:**
- App routes: lowercase (e.g., `app/post/`, `app/category/`)
- Dynamic segments: `[bracket]` (Next.js convention, e.g., `[id]`, `[slug]`)
- Components: `components/` with lowercase subdirs (e.g., `notion/`, `comments/`)
- Templates: `templates/{templateName}/` (e.g., `default/`, `terminal/`)

**CSS/Tailwind:**
- Global styles: `globals.css` (single file, imported in root layout)
- Component styles: Inline Tailwind classes (no separate CSS files)
- Dark mode: Prefix `.dark` (next-themes class-based strategy)
- CSS variables: Defined in `globals.css`, referenced in classes (e.g., `bg-background`, `text-text-primary`)

**Types & Interfaces:**
- Data types: `interface Post` (decoupled from API)
- Component props: `interface {ComponentName}Props` (e.g., `DefaultHomePageProps`)
- Utility types: Inline or co-located with usage

## Where to Add New Code

**New Feature (e.g., "Add series/collection support"):**
- Primary code: `packages/core/src/client.ts` (add NologClient.getSeries() method)
- Update types: `packages/core/src/types.ts` (add Series interface)
- Update data loader: `apps/web/src/lib/notion.ts` (wrap new NologClient method with cache)
- Create page: `apps/web/src/app/series/[slug]/page.tsx`
- Update templates: Add `SeriesPage.tsx` to `apps/web/src/templates/default/` and `terminal/`
- Update site config: `apps/web/src/site.config.ts` if new SEO or feature flag needed

**New Component/Module:**
- Shared UI component: `apps/web/src/components/{FeatureName}.tsx`
- Notion-specific component: `apps/web/src/components/notion/{BlockType}.tsx`
- Comment-related: `apps/web/src/components/comments/{FeatureName}.tsx`
- Server utility: `apps/web/src/lib/{feature}.ts`

**Utilities:**
- Shared helpers: `apps/web/src/lib/{feature}.ts` (if server-side) or `apps/web/src/utils/{feature}.ts` (if client-side)
- Notion API wrappers: `packages/core/src/client.ts` (extend NologClient class)

**Styling:**
- Global styles: Add to `apps/web/src/app/globals.css`
- Component-specific: Use Tailwind classes inline in JSX (no separate CSS files)
- Custom CSS variables: Define in `globals.css` (e.g., `--max-content-width`, `--sidebar-width`)

## Special Directories

**`apps/web/public/`:**
- Purpose: Static assets (images, icons, favicon)
- Generated: No (hand-managed)
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output (cache, generated types, bundles)
- Generated: Yes (by `npm run build`)
- Committed: No (.gitignored)

**`dist/` (packages/core/):**
- Purpose: TypeScript compilation output (CommonJS, ESM, type definitions)
- Generated: Yes (by `npm run build` via tsup)
- Committed: No (.gitignored)

**`node_modules/`:**
- Purpose: Installed dependencies (monorepo shared and workspace-specific)
- Generated: Yes (by `npm install` / `yarn install`)
- Committed: No (.gitignored)

---

*Structure analysis: 2026-07-24*
