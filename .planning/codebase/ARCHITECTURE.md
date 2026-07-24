<!-- refreshed: 2026-07-24 -->
# Architecture

**Analysis Date:** 2026-07-24

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js App Router (Frontend)                 │
│  [Pages: Home, Post, Category, Search + Templates: Default]      │
│  [Terminal variant] — `apps/web/src/app`                         │
│  `apps/web/src/templates/default|terminal`                       │
├──────────────────┬──────────────────┬──────────────────────────┤
│    Page Routes   │   Components     │   Server Actions        │
│  (*.tsx pages)   │  (UI widgets)    │  (getPosts, getPost)    │
│  `src/app/...`   │  `src/components`│  `src/lib/notion.ts`    │
└────────┬─────────┴────────┬─────────┴──────────┬────────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│        Data Access & Caching Layer (ISR + React Cache)          │
│                   `apps/web/src/lib/notion.ts`                   │
│  - React cache() for request deduplication                       │
│  - Next.js ISR via fetchOptions: { next: { revalidate, tags } } │
│  - 180s revalidation window                                      │
└────────┬──────────────────────────┬────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│              Core Data Layer (Monorepo Package)                   │
│                   `packages/core/src/`                            │
│  - NologClient: Direct Notion REST API (bypasses SDK bugs)       │
│  - mapPageToPost: Maps Notion properties to Post interface       │
│  - Types: Post interface (decouples frontend from raw API)       │
└────────┬──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│               External APIs                                       │
│  Notion REST API (/v1/databases/query, /v1/pages/{id})          │
│  notion-client library (unofficial, for page content rendering) │
│  notion-types & notion-utils (react-notion-x rendering)         │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **NologClient** | Query Notion database, fetch pages, handle pagination, filter by status="public" | `packages/core/src/client.ts` |
| **mapPageToPost** | Transform Notion PageObjectResponse into typed Post | `packages/core/src/client.ts` lines 92–105 |
| **Post Type** | Typed interface decoupling frontend from Notion API shape | `packages/core/src/types.ts` |
| **getPosts/getPost** | Server-side data loaders with React cache() deduplication | `apps/web/src/lib/notion.ts` |
| **Page Routes** | Next.js App Router pages: Home, Post, Category, Search | `apps/web/src/app/page.tsx`, `post/[id]/page.tsx`, etc. |
| **Templates** | Two visual variants (default 3-column grid, terminal console UI) | `apps/web/src/templates/default|terminal` |
| **NotionPageRenderer** | Client component rendering full Notion page via react-notion-x | `apps/web/src/components/notion/NotionPageRenderer.tsx` |
| **CommentSection** | Comment widget integrated in post pages | `apps/web/src/components/comments/CommentSection.tsx` |
| **ThemeProvider** | next-themes wrapper for light/dark mode | `apps/web/src/components/ThemeProvider.tsx` |

## Pattern Overview

**Overall:** Multi-tier server-side rendering with template variants and incremental static regeneration (ISR)

**Key Characteristics:**
- Server-first architecture (async React components on all pages)
- Notion database as single source of truth
- Status-based filtering ("public" posts only)
- Dual template system (default marketing, terminal CLI emulation)
- React cache() + Next.js ISR for efficient data fetching
- Direct Notion REST API queries (SDK workaround for inline database bugs)

## Layers

**Presentation Layer:**
- Purpose: Render HTML and handle user navigation
- Location: `apps/web/src/app/`, `apps/web/src/templates/`
- Contains: Next.js pages (Home, Post, Category, Search), template variants (Default, Terminal)
- Depends on: Data Access Layer (lib/notion.ts), Post type from core
- Used by: Browser/user requests

**Data Access & ISR Layer:**
- Purpose: Wrap NologClient with React cache() and Next.js ISR configuration for request deduplication and automatic revalidation
- Location: `apps/web/src/lib/notion.ts`
- Contains: `getPosts()`, `getPost()`, `getCategories()`, `getBlocks()` functions with React cache() wrapper
- Depends on: Core layer (NologClient)
- Used by: All page routes and server components

**Core Business Logic Layer:**
- Purpose: Encapsulate Notion API interactions, data validation, and transformation
- Location: `packages/core/src/`
- Contains: NologClient class, property extractors, mapPageToPost(), Post type definition
- Depends on: @notionhq/client SDK
- Used by: Data Access Layer

**Content Rendering Layer:**
- Purpose: Render full Notion page blocks with syntax highlighting and Mermaid diagrams
- Location: `apps/web/src/components/notion/`
- Contains: NotionPageRenderer (client), NotionCode (Mermaid + syntax highlighting), MermaidBlock
- Depends on: react-notion-x, notion-client, notion-types, shiki, mermaid
- Used by: Post pages

**Configuration Layer:**
- Purpose: Single source of truth for site metadata, SEO, profile, theme, and feature toggles
- Location: `apps/web/src/site.config.ts`
- Contains: Site title/URL, profile info, SNS links, template selection, ISR revalidation interval
- Depends on: Nothing
- Used by: All pages and components

## Data Flow

### Primary Request Path: Home → Post List

1. User visits `/` (`apps/web/src/app/page.tsx`)
2. Server calls `getPosts()` from `apps/web/src/lib/notion.ts`
3. React cache() deduplicates multiple calls to `getPosts()` within one render
4. NologClient.getPosts() makes REST API call to `https://api.notion.com/v1/databases/{databaseId}/query`
5. Query filters: `property: "status", select: { equals: "public" }`, sorts by created_time descending
6. Notion returns PageObjectResponse[] (paginated, handles cursor)
7. mapPageToPost() transforms each PageObjectResponse → Post
8. Post[] returned to page component
9. Template selected (DEFAULT_TEMPLATE or TERMINAL_TEMPLATE)
10. DefaultHomePage/TerminalHomePage renders Post[]: card grid or terminal list
11. Next.js ISR caches response for 180 seconds, then revalidates

### Secondary Request Path: Post Content Rendering

1. User visits `/post/[id]` (`apps/web/src/app/post/[id]/page.tsx`)
2. `generateMetadata()` calls `getPost(id)` → returns Post for OpenGraph tags
3. Page component calls:
   - `getPost(id)` → Post object (title, author, summary, etc.)
   - `getPageRecordMap(id)` → notion-client fetches full page blocks (ExtendedRecordMap)
   - `getCategories()` → categories list for related-posts sidebar
   - `getPosts()` → filter posts by same category for "related posts"
4. Post and recordMap passed to template (DefaultPostPage or TerminalPostPage)
5. NotionPageRenderer (client component, lazy-loaded) renders recordMap using react-notion-x
6. NotionCode intercepts code blocks: detects language="mermaid" and renders MermaidBlock
7. CommentSection loads below post content
8. All fetches deduplicated via React cache() for same request within render

### Search & Filter Flow

**Category Page:**
1. User visits `/category/[slug]` (`apps/web/src/app/category/[slug]/page.tsx`)
2. Page fetches all posts via `getPosts()` (single call, cached)
3. Client-side JavaScript filters: `post.category.toLowerCase().replace(/\s+/g, "-") === slug`
4. Matching posts rendered by DefaultCategoryPage or TerminalCategoryPage

**Search Page:**
1. User submits query at `/search?q=typescript` (`apps/web/src/app/search/page.tsx`)
2. Page fetches all posts via `getPosts()` (single call, cached)
3. Filters on server: title, summary, category, tags all checked against query (case-insensitive)
4. Matching posts passed to DefaultSearchPage or TerminalSearchPage

**State Management:**
- No Redux/Zustand; all state server-side in React components
- Terminal template uses sessionStorage for UI state (e.g., "nolog_last_path" for navigation memory)
- Theme state via next-themes (persisted to localStorage)
- Search state via URL query params (next/navigation.useSearchParams)

## Key Abstractions

**Post Interface:**
- Purpose: Decouples UI from raw Notion API response shape; allows easy schema migrations
- Examples: `packages/core/src/types.ts` (primary), `apps/web/src/types/index.ts` (re-export)
- Pattern: Single-responsibility DTO, maps Notion property names (Name, Summary, Category) to camelCase (title, summary, category)

**NologClient:**
- Purpose: Encapsulates all Notion API interactions (database queries, page fetches, block listing)
- Examples: `packages/core/src/client.ts`
- Pattern: Class-based client with public methods (getPosts, getPost, getCategories, getBlocks) and private query builder (queryDatabase)

**Template System:**
- Purpose: Allow multiple visual variants (Default marketing, Terminal CLI) without duplicating page logic
- Examples: `apps/web/src/templates/default/*` vs `apps/web/src/templates/terminal/*`
- Pattern: Each page (Home, Post, Category, Search) has default and terminal variant; `src/app/page.tsx` routes based on CONFIG.template

**React Cache Wrapper:**
- Purpose: Deduplicate identical data fetches within a single render cycle
- Examples: `apps/web/src/lib/notion.ts` wraps NologClient methods
- Pattern: `export const getPosts = cache(async () => nologClient.getPosts())`

## Entry Points

**Homepage:**
- Location: `apps/web/src/app/page.tsx`
- Triggers: User visits `/`
- Responsibilities: Fetch all public posts, select template, render post grid

**Post Page:**
- Location: `apps/web/src/app/post/[id]/page.tsx`
- Triggers: User visits `/post/{postId}`
- Responsibilities: Fetch post metadata, fetch full page content (recordMap), render with NotionPageRenderer

**Category Page:**
- Location: `apps/web/src/app/category/[slug]/page.tsx`
- Triggers: User visits `/category/{categorySlug}`
- Responsibilities: Fetch all posts, filter by category slug, render filtered list

**Search Page:**
- Location: `apps/web/src/app/search/page.tsx`
- Triggers: User visits `/search?q={query}`
- Responsibilities: Fetch all posts, filter by query (title, summary, category, tags), render results

**Root Layout:**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: Every page request
- Responsibilities: Fetch categories, select template layout, provide ThemeProvider, inject Analytics

**OG Image Generator:**
- Location: `apps/web/src/app/api/og/route.tsx`
- Triggers: When sharing posts on social media (via og:image in metadata)
- Responsibilities: Generate 1200x630 PNG with post title and category

## Architectural Constraints

- **Server-First Rendering:** All page routes are async Server Components. No CSR route entry points (Suspense boundaries used for streaming, but all initial data is server-fetched).
- **Single Notion Database:** Architecture assumes one Notion database per deployment. Multi-database support requires schema changes.
- **Status Filter Hard-Coded:** Only posts with `status === "public"` are rendered. No admin panel for visibility toggling; changes require re-publishing from Notion.
- **Direct REST API Queries:** NologClient uses raw fetch() instead of @notionhq/client SDK's dataSources.query because SDK v5.20 has bugs with inline (child) databases. If SDK fixes this, could refactor to use SDK exclusively.
- **Two Template System:** Hard-coded to either "default" or "terminal" via CONFIG.template. Adding a third template requires duplicating HomePage, PostPage, CategoryPage, SearchPage components.
- **ISR Revalidation:** All posts revalidate on same schedule (180s). No per-post granularity. Cache invalidation via `next/cache` would require manual trigger (no webhooks to Notion implemented).
- **React Cache() Deduplication:** Depends on identical async function calls within a single render cycle. Different request parameters (e.g., different post IDs) are not deduplicated across renders.

## Anti-Patterns

### Notion SDK Workaround

**What happens:** NologClient bypasses @notionhq/client's dataSources.query method and uses raw fetch() to query the Notion database. This is because SDK v5.20 has a bug where it fails on inline (child) databases.

**Why it's wrong:** Bypassing the SDK means:
- Manual header management (Authorization, Notion-Version)
- Manual pagination handling
- Loss of SDK's type safety (raw fetch returns unknown, requires type guards)
- Maintenance burden if Notion API changes

**Do this instead:** Upgrade @notionhq/client when bug is fixed, or file an issue/PR with the SDK maintainers. In the meantime, the workaround is documented and localized to `packages/core/src/client.ts` (queryDatabase method), making it easy to replace.

### Duplicate Post Type Definition

**What happens:** Post interface is defined twice: once in `packages/core/src/types.ts` and again in `apps/web/src/types/index.ts`. They are identical but not shared.

**Why it's wrong:** Maintenance burden; schema changes must be updated in two places. Increases risk of type mismatch.

**Do this instead:** Export Post from @4lph4/nolog-core package in apps/web instead of re-defining. Change `apps/web/src/types/index.ts` to: `export { Post } from "@4lph4/nolog-core"`. This is a quick fix and aligns with DRY principle.

### Template Duplication

**What happens:** HomePage, PostPage, CategoryPage, SearchPage each have two implementations: default/ and terminal/. ~300 LOC duplicated.

**Why it's wrong:** Bug fixes in one template don't propagate to the other. Layout changes require updates in multiple places.

**Do this instead:** Refactor templates to a shared page component with a template-scoped layout wrapper. Example:
```typescript
// apps/web/src/app/page.tsx
const PageContent = await renderHomePage(posts, categories); // shared
const Layout = CONFIG.template === "default" ? DefaultLayout : TerminalLayout;
return <Layout>{PageContent}</Layout>;
```
This reduces code duplication while keeping visual variants modular.

## Error Handling

**Strategy:** Graceful degradation with try-catch at page level

**Patterns:**
- **Missing Notion Config:** If NOTION_TOKEN or NOTION_DATABASE_ID are not set, getPost/getPosts catch error and return empty array/null. Pages render empty state with instructions.
- **Network Failure:** Notion API errors (404, 500, timeout) are caught in NologClient.getPost() and return null. Pages show "Content could not be loaded" message.
- **Content Rendering Failure:** If recordMap is null or recordMap is not ExtendedRecordMap shape, NotionPageRenderer shows fallback message instead of crashing.
- **Search Filtering:** If a post has no category/tags, filter just skips that property. Never crashes.

No global error boundary implemented; pages degrade independently.

## Cross-Cutting Concerns

**Logging:** 
- Basic console.error in error catch blocks (`[PostPage] Failed to fetch...`, `[OG Route Error] ...`)
- No structured logging or external service (e.g., Sentry)
- Vercel Analytics injected for performance metrics

**Validation:**
- Type guards in NologClient (isPageObjectResponse, isNotionQueryResponse)
- Property extraction with fallback keys (e.g., getRichText checks "Summary" and "summery")
- Client-side filtering assumes well-formed Post objects from server

**Authentication:**
- Notion token stored in process.env.NOTION_TOKEN (server-only)
- notion-client (unofficial) uses optional NOTION_TOKEN_V2 for private pages (edge case)
- No user authentication; all posts are public by default (filtered by status property)

---

*Architecture analysis: 2026-07-24*
