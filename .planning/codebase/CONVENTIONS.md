# Coding Conventions

**Analysis Date:** 2026-07-24

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension (e.g., `ThemeToggle.tsx`, `CommentSection.tsx`)
- Utilities/functions: camelCase with `.ts` extension (e.g., `notion.ts`, `notion-x.ts`)
- Config files: camelCase or kebab-case (e.g., `site.config.ts`, `eslint.config.mjs`)
- Types files: `index.ts` in a types directory (e.g., `src/types/index.ts`)

**Functions:**
- camelCase for all function names (e.g., `getPosts`, `getPost`, `getCategories`)
- Descriptive action verbs: `get*`, `fetch*`, `render*`, `measure*`, `parse*`, `map*`
- Private functions: prefix with underscore or use private class methods (e.g., `private queryDatabase()`)
- Type guard functions: `is*` pattern (e.g., `isPageObjectResponse`, `isNotionQueryResponse`)
- Handler functions: `on*` or `handle*` (e.g., `onClick`, `handleMessage`)

**Variables:**
- camelCase for all local and module-level variables
- Constants: ALL_CAPS (e.g., `MIN_IFRAME_HEIGHT`, `NOTION_CACHE_TAG`, `DATABASE_ID`)
- Boolean variables: often prefixed with `is` or `has` (e.g., `isCopied`, `mermaidReady`, `isDark`)
- React state: plain camelCase (e.g., `mounted`, `mode`, `error`)
- DOM references: suffix with `Ref` (e.g., `containerRef`, `copyTimeout`, `idRef`)

**Types:**
- Interfaces: PascalCase with descriptive names (e.g., `CommentSectionProps`, `MermaidBlockProps`, `Post`, `NologClientOptions`)
- Props interfaces: component name + `Props` suffix (e.g., `CommentSectionProps`)
- Type aliases: PascalCase for union/literal types (e.g., `ViewMode = "preview" | "code" | "split"`)
- Types exported from values: `type T = typeof CONST` pattern (e.g., `export type SiteConfig = typeof CONFIG`)

**Environment Variables:**
- Public vars (client-side): `NEXT_PUBLIC_*` prefix (e.g., `NEXT_PUBLIC_CUSDIS_APP_ID`)
- Private vars (server-side): no prefix (e.g., `NOTION_TOKEN`, `NOTION_DATABASE_ID`)

## Code Style

**Formatting:**
- 2-space indentation throughout
- Semicolons at end of all statements
- Line wrapping with logical grouping
- No unused imports or variables (enforced by ESLint)
- Consistent spacing around operators and after keywords

**Linting:**
- Framework: ESLint 9 with Next.js config
- Config: `apps/web/eslint.config.mjs` uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Run: `npm run lint` in `apps/web`
- No custom Prettier config — uses Next.js default formatting

**TypeScript:**
- Strict mode enabled (`strict: true` in tsconfig.json)
- JSX: `react-jsx` mode (automatic JSX transform)
- Module resolution: `bundler`
- Path aliases: `@/*` → `./src/*` for clean imports
- Nullable types: explicitly use `Type | null` or optional properties

## Import Organization

**Order:**
1. External packages (React, Next.js, third-party libraries)
2. Type imports from external packages (using `type` keyword)
3. Internal absolute imports (using `@/` alias)
4. Internal relative imports (using `./` or `../`)
5. Type-only imports from internal modules (using `type` keyword)

**Path Aliases:**
- Use `@/` prefix for all non-relative imports: `import { getPosts } from "@/lib/notion"`
- Never use relative paths when `@/` alias is available
- Alias defined in `apps/web/tsconfig.json`: `"@/*": ["./src/*"]`

**Examples:**
```typescript
// ✓ Correct order
import { cache } from "react";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Post } from "@/types";
import { CONFIG } from "@/site.config";
import { NologClient } from "@4lph4/nolog-core";
import { getBlocks } from "./local-helper";
```

## Error Handling

**Try-Catch Pattern:**
- Catch errors silently with fallback values (empty arrays, null, empty objects)
- Return null for missing/not-found cases: `if (!res.ok) throw new Error(...)`
- In API routes, catch with type annotation: `catch (error: unknown)`
- Never throw in component render paths — handle with state instead

**Error Type Checking:**
- Check if error is Error instance: `error instanceof Error ? error.message : String(error)`
- Use nullish coalescing for safe message extraction: `error?.message ?? "Unknown error"`
- Catch all branches with early returns: `if (!condition) return;`

**Error Logging:**
- Log with context prefix: `console.error("[ComponentName] Message:", error)`
- Log to console.warn for recoverable issues
- Include error message and relevant context
- Pattern: `console.error(\`[Context] Description: ${message}\`)`

**Graceful Degradation:**
```typescript
// ✓ Correct pattern
try {
  posts = await getPosts();
  categories = await getCategories();
} catch {
  // Gracefully handle missing Notion config
  posts = [];
  categories = [];
}
```

**Optional Features:**
- Gate features by environment variable presence: `if (!appId) return null;`
- Render placeholder on missing config, not error
- Pattern: return early if required env var is missing

## Logging

**Framework:** Native console methods (no logging library)

**Patterns:**
- Use `console.log()` for development/informational messages
- Use `console.warn()` for recoverable issues: `console.warn("[MermaidBlock] Render error:", err)`
- Use `console.error()` for errors: `console.error("[PostPage] Failed to fetch:", error)`
- All logs include context prefix in brackets: `[ComponentOrModuleName]`
- Log error objects directly, not just strings, to preserve stack traces

**Examples:**
```typescript
console.warn("[MermaidBlock] Render error:", err);
console.error(`[OG Route Error] ${message}`);
console.error("[PostPage] Failed to fetch page recordMap or categories:", error);
```

## Comments

**When to Comment:**
- Explain non-obvious logic or complex algorithms
- Document workarounds or intentional deviations from standard patterns
- Mark important boundaries or sections
- Explain why something was done, not what (code should be self-documenting)

**JSDoc/TSDoc:**
- Use JSDoc for public components and functions
- Include description, param types, and return type
- Mark parameters as optional with `?`
- Pattern: `/** Description on single or multiple lines. */`

**Examples:**
```typescript
/**
 * Dark / Light mode toggle button.
 * Renders a Sun (light) or Moon (dark) icon from lucide-react.
 * Uses useEffect + mounted guard to avoid hydration mismatches.
 */
export function ThemeToggle() { ... }

/**
 * Optimized Cusdis integration.
 * Uses a polling mechanism to ensure the script is loaded and the widget is rendered properly.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) { ... }

/**
 * Query a Notion database via the REST API directly.
 * Bypasses the SDK's `dataSources.query` because in v5.20 it fails on
 * inline (child) databases.
 */
private async queryDatabase(body: Record<string, unknown>): Promise<NotionQueryResponse> { ... }
```

**Inline Comments:**
- Use sparingly, only for non-obvious logic
- Place above the code being explained
- Example: `// Prevent hydration mismatch — render a placeholder with matching dimensions`

**Section Separators:**
- Use comment dividers for major sections: `// ─── Property extractors ────────────────────────`
- Use for grouping related functions
- Pattern: ` // ─── Section Name ────────────────────────────────────────────`

## Function Design

**Size:** Keep functions focused and under 50-100 lines where practical

**Parameters:**
- Destructure props in component parameters: `function Component({ prop1, prop2 }: Props)`
- Use single object parameter for multiple related options
- Type all parameters explicitly

**Return Values:**
- Return null for optional/missing values, not undefined
- Return empty arrays `[]`, not null, for collections
- Return empty strings `""` for text defaults
- Use explicit return type annotations for public functions

**Server vs. Client Components:**
- Mark client components with `"use client"` directive at top
- Server components are async by default
- Fetch data in server components, pass to client via props
- Use client components only when hooks (useState, useEffect) are needed

**Example:**
```typescript
// ✓ Correct async server component with data fetching
export default async function HomePage() {
  let posts: Post[];
  try {
    posts = await getPosts();
  } catch {
    posts = [];
  }
  
  return <DefaultHomePage posts={posts} />;
}

// ✓ Correct client component with hooks
"use client";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  
  return <button>...</button>;
}
```

## Module Design

**Exports:**
- Use named exports: `export const getPosts = cache(async () => { ... })`
- Use default exports only for single-export modules (rare)
- Re-export convenience: `export const notion = nologClient.notion;`

**Barrel Files:**
- Use `src/types/index.ts` as single export point for all types
- Pattern: `export interface TypeName { ... }`

**Private Functions:**
- Mark internal helpers as private when in classes: `private getTitle(page: PageObjectResponse): string`
- Use file-level functions for module-private helpers (no special marking needed)

## Conditional Rendering

**Pattern:**
- Use early returns for guard clauses: `if (!mounted) return null;`
- Use ternary for simple if-else: `condition ? <A /> : <B />`
- Use logical AND for single branch: `{condition && <Component />}`
- Never use if-else inside JSX — extract to separate renders or helpers

**Hydration Safety:**
- Use `useState` + `useEffect` + `mounted` guard for client-only rendering
- Pattern: initialize state with `false`, set to `true` in useEffect with timeout
- Return placeholder with matching dimensions on server: `if (!mounted) return <div style={{height: '200px'}} />;`

**Examples:**
```typescript
// ✓ Guard clause with early return
if (!appId) {
  return null;
}

if (!mounted) {
  return <Placeholder />;
}

// ✓ Ternary for render options
const isDark = resolvedTheme === "dark";
return isDark ? <SunIcon /> : <MoonIcon />;

// ✓ Logical AND for optional render
{error && <ErrorDisplay message={error} />}
```

## React Patterns

**Hooks:**
- Always call hooks at top level of component
- List dependencies explicitly in dependency arrays
- Use `useCallback` to memoize event handlers: `const handler = useCallback(() => { ... }, [deps])`
- Use `useMemo` for expensive computations: `const options = useMemo(() => [...], [])`
- Use `useRef` for DOM access and persistent values

**Cleanup:**
- Return cleanup function from useEffect when needed
- Cancel async operations in cleanup: `const cancelled = useRef(false)`
- Clear timers, observers, and event listeners in cleanup

**Example:**
```typescript
const copyTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

const onClickCopyToClipboard = useCallback(() => {
  navigator.clipboard.writeText(code);
  setIsCopied(true);
  if (copyTimeout.current) {
    clearTimeout(copyTimeout.current);
    copyTimeout.current = undefined;
  }
  copyTimeout.current = setTimeout(() => {
    setIsCopied(false);
  }, 1200);
}, [code]);

useEffect(() => {
  return () => {
    if (copyTimeout.current) {
      clearTimeout(copyTimeout.current);
    }
  };
}, []);
```

## Type Safety

**Generic Constraints:**
- Type function arguments: `async function getBlocks(blockId: string)`
- Type return values: `Promise<Post | null>`, `Promise<Post[]>`
- Use type guards for unknown values: `if (typeof data === "object" && data !== null)`

**Narrowing:**
- Use `instanceof` checks: `error instanceof Error ? error.message : String(error)`
- Use type predicates for custom guards: `function isPageObjectResponse(value: unknown): value is PageObjectResponse`
- Use optional chaining for safe access: `response?.results?.filter(...)`
- Use nullish coalescing for defaults: `const value = obj.prop ?? defaultValue`

---

*Convention analysis: 2026-07-24*
