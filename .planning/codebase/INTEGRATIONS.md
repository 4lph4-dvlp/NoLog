# External Integrations

**Analysis Date:** 2026-07-24

## APIs & External Services

**Notion API:**
- Service: Notion REST API v2022-06-28
  - What it's used for: Fetch posts, categories, blocks; render rich content from Notion database
  - SDK/Client: `@notionhq/client` 5.20.0
  - Implementation: `packages/core/src/client.ts` (`NologClient` class)
  - Auth: Bearer token in Authorization header (`process.env.NOTION_TOKEN`)
  - Endpoints:
    - `GET /v1/pages/{pageId}` - Fetch single page metadata
    - `POST /v1/databases/{databaseId}/query` - Query database with filters/sorting
    - `GET /v1/blocks/{blockId}/children` - Fetch page blocks for rendering
  - Error handling: Throws on non-200 status; catches 404 and returns null

**Cusdis (Comments):**
- Service: Cusdis comment widget (https://cusdis.com)
  - What it's used for: Optional embedded comment system for blog posts
  - Implementation: `apps/web/src/components/comments/CommentSection.tsx`
  - Auth: App ID passed as `data-app-id` attribute
  - Gating: Conditional - component returns null if `NEXT_PUBLIC_CUSDIS_APP_ID` env var is not set
  - Loading: Script injected from `https://cusdis.com/js/cusdis.es.js` at runtime
  - Theme support: Syncs light/dark mode via `window.CUSDIS.setTheme()`
  - Data attributes passed to Cusdis widget:
    - `data-host="https://cusdis.com"`
    - `data-app-id` - Cusdis project ID
    - `data-page-id` - Post ID (Notion page UUID)
    - `data-page-url` - Canonical post URL
    - `data-page-title` - Post title
    - `data-theme` - "dark" | "light"

## Data Storage

**Databases:**
- Notion Database (sole datastore)
  - Connection: REST API via `NOTION_TOKEN` and `NOTION_DATABASE_ID` env vars
  - Client: `@notionhq/client` (Notion official SDK)
  - Wrapper: `@4lph4/nolog-core` NologClient
  - Schema: Posts queried from database with required properties:
    - `Name` (title) or `title` or `Title` - Title field
    - `Summary` or `summery` - Rich text description (typo fallback)
    - `Category` or `category` - Single select
    - `Tag` or `tag` - Multi select
    - `Thumbnail` or `thumbnail` - File property
    - `Author` or `author` - People or rich text
    - `Status` or `status` - Single select (filtered to "public")
  - Filtering: Only posts with Status = "public" are rendered
  - Pagination: Cursor-based pagination handles databases > 100 posts

**File Storage:**
- AWS S3 (Notion's asset CDN)
  - Domains configured in Next.js: `s3.us-west-2.amazonaws.com`, `prod-files-secure.s3.us-west-2.amazonaws.com`
  - Used for: Notion file assets (thumbnails, embedded images in posts)
  - Access: Public URLs from Notion API response

**Caching:**
- Next.js ISR (Incremental Static Regeneration)
  - Revalidation interval: 180 seconds (configurable in `CONFIG.revalidate`)
  - Cache tag: "notion-posts" for on-demand revalidation
  - Applied to all Notion fetch calls via `next: { revalidate, tags }` fetch option
  - Edge cache: Vercel's edge network caches ISR pages

## Authentication & Identity

**Auth Provider:**
- Notion Integration (custom bearer token)
  - Implementation: Bearer token in Authorization header
  - Requirement: Must create integration at notion.so/my-integrations
  - Token storage: `NOTION_TOKEN` environment variable
  - Database access: Integration must be added to database via "Connections"

**Web Rendering:**
- Notion Share-to-web requirement
  - Needed for `react-notion-x` to fetch and render page blocks
  - Requirement: Database page must have "Share to web" enabled
  - No additional auth needed for block fetching (public URLs)

## Monitoring & Observability

**Analytics:**
- Vercel Web Analytics (`@vercel/analytics`)
  - Implementation: `<Analytics />` component in `apps/web/src/app/layout.tsx`
  - Provides: Page view metrics, Core Web Vitals monitoring
  - Deployment: Automatic via Vercel platform

**Errors:**
- Error tracking: Not configured (no Sentry/DataDog)
- OG image generation errors: Logged to console in `apps/web/src/app/api/og/route.tsx`
  - Returns 500 response on failure

**Logs:**
- Console logging only (development/edge runtime)
  - Example: `console.error("[OG Route Error]")` in OG generation

**Search Console Integration:**
- Google Search Console verification: Meta tag via `verification.google` in metadata
- Naver Search Advisor: Meta tag via `verification.other["naver-site-verification"]`
- Both configured in `apps/web/src/site.config.ts` (optional)

## CI/CD & Deployment

**Hosting:**
- Vercel (Platform)
  - Deployment: GitHub-based auto-deployment
  - Build: Next.js builds run on Vercel's infrastructure
  - Rendering: ISR pages cached on Vercel edge network
  - Edge Functions: OG image generation runs on Vercel Edge Runtime

**CI Pipeline:**
- GitHub (source repository)
  - Vercel auto-deploys on push to main/specified branch
  - No explicit CI workflow configured (GitHub Actions not detected)

**Environment Configuration:**
- Vercel dashboard: Environment variables set via dashboard
  - `NOTION_TOKEN` (secret)
  - `NOTION_DATABASE_ID` (can be public)
  - `NEXT_PUBLIC_CUSDIS_APP_ID` (public, prefixed with NEXT_PUBLIC_)

## Environment Configuration

**Required env vars:**
- `NOTION_TOKEN` - Notion integration bearer token (secrets)
- `NOTION_DATABASE_ID` - Notion database UUID (can be public)

**Optional env vars:**
- `NEXT_PUBLIC_CUSDIS_APP_ID` - Cusdis app ID (public, enables comments if set)

**Secrets location:**
- Vercel dashboard (Environment Variables section)
- Local development: Create `.env.local` (not committed)

**Notion Setup:**
1. Create integration at notion.so/my-integrations
2. Save integration token as `NOTION_TOKEN`
3. Add integration to database via "Connections"
4. Enable "Share to web" on database page
5. Extract database ID from URL: `notion.so/{workspace_id}/DataDashboard-{DATABASE_ID}`

## Webhooks & Callbacks

**Incoming:**
- None configured

**Outgoing:**
- Notion API calls (REST API only, no webhooks)
- Cusdis: Data sent via iframe postMessage for resize synchronization
  - Cusdis iframe → host page via `window.addEventListener("message")`
  - Handlers in `apps/web/src/components/comments/CommentSection.tsx`
  - Message format: `{ from: "cusdis", event: "resize", data: height }`

## Content Delivery

**OG Image Generation:**
- Route: `apps/web/src/app/api/og/route.tsx`
- Runtime: Vercel Edge Runtime
- Triggers: Dynamic meta tags in post pages at `apps/web/src/app/post/[id]/page.tsx`
- Parameters: `title` and `category` query params
- Response: 1200x630 PNG image generated by `ImageResponse` from `next/og`

**Sitemap Generation:**
- Route: `apps/web/src/app/sitemap.ts`
- Fetches: All posts from Notion via `getPosts()`
- Output: XML sitemap for SEO

**Robots.txt:**
- Route: `apps/web/src/app/robots.ts`
- Configurable: Respects `CONFIG.seo.allowIndexing` setting

---

*Integration audit: 2026-07-24*
