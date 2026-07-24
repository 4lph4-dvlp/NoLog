# Testing Patterns

**Analysis Date:** 2026-07-24

## Test Framework

**Status:** Not Configured

**Finding:** This project has **ZERO test infrastructure**. No test framework, configuration, dependencies, or test files exist anywhere in the codebase.

**Verification:**
- No test dependencies in any `package.json`: not a single entry for `jest`, `vitest`, `playwright`, `cypress`, `mocha`, `chai`, or `@testing-library`
- No test configuration files: no `jest.config.*`, `vitest.config.*`, `playwright.config.*`, or `cypress.config.*`
- No test files in the repository: zero `.test.*` or `.spec.*` files anywhere
- No test scripts in package.json: neither `apps/web/package.json` nor `packages/core/package.json` contains any test commands

**Location of test infrastructure:** Not present

## Absence of Testing

### Why It Matters

This is a **significant gap** for a production Next.js application:

- No unit tests for critical functions like `mapPageToPost`, `getPost`, `getPosts`
- No integration tests for API routes (e.g., `/api/og` image generation)
- No component tests for complex UI like `CommentSection` or `MermaidBlock`
- No end-to-end tests for the blog workflow (viewing posts, filtering by category, etc.)
- No type-safety verification at runtime (TypeScript catches compile-time errors only)
- No regression protection — breaking changes are not caught automatically

### Risk Areas Without Tests

**Core Library (`packages/core/src/client.ts`):**
- Notion API client type transformations (e.g., `mapPageToPost`)
- Pagination logic in `getPosts` (do-while cursor handling)
- Database query filtering by status
- Property extraction fallbacks (e.g., title with "Untitled" default)

**API Routes (`apps/web/src/app/api/og/route.tsx`):**
- Image generation with dynamic titles/categories
- Query parameter parsing and truncation
- Error handling and fallback responses

**Components with Complex Logic:**
- `CommentSection.tsx`: 330+ lines of iframe management, polling, resize handling, theme synchronization
- `MermaidBlock.tsx`: 200+ lines of dynamic import, dark mode detection, error states, mode switching
- Hydration safety in `ThemeToggle`, `CommentSection` (mounted guard pattern)

**Data Fetching:**
- Async server components in `app/page.tsx`, `app/post/[id]/page.tsx` without test coverage
- Error handling returns empty arrays/null — no verification of behavior

## Recommended Testing Strategy

### Phase 1: Unit Tests (Foundation)

**Test Framework:** Vitest (lightweight, Vue/React optimized, fast)

**Setup:**
```json
{
  "devDependencies": {
    "vitest": "^2.x",
    "@vitest/ui": "^2.x",
    "@testing-library/react": "^16.x",
    "@testing-library/dom": "^10.x"
  }
}
```

**Test Files to Create:**
1. `packages/core/src/__tests__/client.test.ts` — Test Notion API integration
2. `apps/web/src/__tests__/api/og/route.test.tsx` — Test image generation
3. `apps/web/src/components/__tests__/CommentSection.test.tsx` — Test comment widget logic
4. `apps/web/src/components/__tests__/MermaidBlock.test.tsx` — Test diagram rendering

**Priority Tests:**
- `mapPageToPost` transformations (null handling, field extraction)
- `getPost` 404 handling and public status filtering
- Image generation URL parsing and parameter validation
- Iframe resize message parsing in `CommentSection`
- Mermaid render error states

### Phase 2: Integration Tests (Workflows)

**Test Framework:** Same Vitest (with `@testing-library/react`)

**Coverage:**
- Full post page loading (data fetch → render)
- Category filtering
- Search functionality
- Template switching based on config

### Phase 3: E2E Tests (User Flows)

**Test Framework:** Playwright (browser automation)

**Coverage:**
- Homepage load and navigation
- Post viewing with comments
- Dark mode toggle
- Search and filtering

## Current State: Manual Testing Only

Until tests are implemented, this project relies on:

1. **Manual QA** — Browser testing, clicking around
2. **TypeScript Compilation** — Catches type errors at build time
3. **ESLint** — Enforces code quality rules
4. **Visual Inspection** — Code review of logic

**Gaps:**
- No automated regression detection
- No confidence before production deployments
- No documented test cases or requirements
- Breaking changes discovered only in production or during manual testing

## Where Tests Should Go

**Monorepo Structure:**

```
apps/web/
├── src/
│   ├── __tests__/          # Test files mirroring src/ structure
│   │   ├── api/
│   │   │   └── og.test.tsx
│   │   ├── components/
│   │   │   ├── CommentSection.test.tsx
│   │   │   └── MermaidBlock.test.tsx
│   │   └── lib/
│   │       └── notion.test.ts
│   ├── app/
│   ├── components/
│   └── lib/

packages/core/
├── src/
│   ├── __tests__/          # Test files
│   │   └── client.test.ts
│   ├── client.ts
│   ├── types.ts
│   └── index.ts
```

**Run Commands (After Implementation):**
```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage report
```

## Test Patterns to Use (When Implemented)

### Unit Test Structure

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mapPageToPost } from "@/client";

describe("mapPageToPost", () => {
  it("should extract title from Name property", () => {
    const page = { id: "123", properties: { Name: { ... } } };
    const post = mapPageToPost(page as PageObjectResponse);
    expect(post.title).toBe("Expected Title");
  });

  it("should return 'Untitled' for missing title", () => {
    const page = { id: "123", properties: {} };
    const post = mapPageToPost(page as PageObjectResponse);
    expect(post.title).toBe("Untitled");
  });
});
```

### Component Test Structure (React)

```typescript
import { render, screen } from "@testing-library/react";
import { ThemeToggle } from "@/components/ThemeToggle";

describe("ThemeToggle", () => {
  it("should render button after mount", async () => {
    render(<ThemeToggle />);
    // Wait for hydration
    await new Promise(r => setTimeout(r, 10));
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

### Mocking Patterns

**Mock Notion API:**
```typescript
vi.mock("@/lib/notion", () => ({
  getPosts: vi.fn().mockResolvedValue([
    { id: "1", title: "Post 1", category: "Tech", ... }
  ]),
}));
```

**Mock Environment Variables:**
```typescript
import.meta.env.NEXT_PUBLIC_CUSDIS_APP_ID = "test-app-id";
```

**Mock DOM APIs:**
```typescript
vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn() }
});
```

## Coverage Goals (When Implemented)

**Minimum acceptable coverage:**
- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

**Critical paths requiring 100% coverage:**
- `packages/core/src/client.ts` — Core business logic
- Error handling in API routes
- Type guards and validation functions

## Known Testing Challenges

1. **Hydration mismatches** — Client-side mount guards need special testing (e.g., render, wait for hydration, verify)
2. **Dynamic imports** — Mermaid library loaded at runtime; needs mock or real import
3. **Iframe communication** — CommentSection uses postMessage; needs mock MessageEvent
4. **Next.js specifics** — generateMetadata, generateStaticParams require special test setup
5. **External APIs** — Notion API calls need mocking; consider using mock data factories

## Lint Configuration

The codebase uses ESLint (v9) with Next.js configuration, which helps catch some issues:

**Config:** `apps/web/eslint.config.mjs`

**Rules Applied:**
- Next.js Core Web Vitals rules
- TypeScript strict mode rules
- ESLint recommended rules

**Run:** `npm run lint` in `apps/web/`

This catches unused variables, missing dependencies, and common mistakes, but **cannot replace tests for logic correctness**.

---

*Testing analysis: 2026-07-24*
