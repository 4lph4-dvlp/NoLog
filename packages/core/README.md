# @4lph4/nolog-core

The core engine for the [NoLog](https://github.com/your-username/nolog) project. This package provides a pure, backend-compatible TypeScript SDK for interacting with a Notion database specifically configured for NoLog.

This library decouples the Notion API fetching and data mapping logic from the Next.js presentation layer, allowing you to use the NoLog engine in any Node.js environment (e.g., NestJS, Express, raw Node.js scripts).

## Installation

```bash
npm install @4lph4/nolog-core
```

*(Note: Ensure you have your Notion Integration Token and Database ID ready.)*

## Features

- **Pure TypeScript:** No dependencies on React or Next.js.
- **Built-in Type Definitions:** Provides the exact `Post` interface expected by NoLog frontends.
- **Bypasses SDK Bugs:** Uses a direct REST API fallback for database queries to bypass known bugs in the official `@notionhq/client` (v5.20) regarding inline databases.

## Usage

### 1. Initialize the Client

```typescript
import { NologClient } from '@4lph4/nolog-core';

const nolog = new NologClient({
  token: 'ntn_your_notion_integration_token',
  databaseId: 'your_notion_database_id',
  // Optional: Pass custom fetch options (e.g., for Next.js caching)
  // fetchOptions: { next: { revalidate: 60 } }
});
```

### 2. Fetch Posts

```typescript
async function fetchMyPosts() {
  // Returns an array of mapped Post objects
  const posts = await nolog.getPosts();
  console.log(`Found ${posts.length} public posts.`);
}
```

### 3. Fetch a Single Post

```typescript
async function fetchSinglePost(pageId: string) {
  // Returns a Post object or null if not found/not public
  const post = await nolog.getPost(pageId);
  console.log(post?.title);
}
```

### 4. Fetch Categories

```typescript
async function fetchUniqueCategories() {
  // Returns an array of unique category strings used across all posts
  const categories = await nolog.getCategories();
  console.log(categories);
}
```

### 5. Fetch Blocks (Content)

```typescript
async function fetchPostContent(pageId: string) {
  // Returns an array of Notion Block objects for rendering
  const blocks = await nolog.getBlocks(pageId);
  console.log(blocks);
}
```

## Types

The SDK provides the `Post` interface which represents a mapped Notion page:

```typescript
export interface Post {
  id: string;
  title: string;
  summary: string;
  thumbnail: string | null;
  category: string;
  tags: string[];
  author: string;
  createDate: string;
  editDate: string;
  status: string;
}
```

## Contributing

This package is part of the NoLog monorepo. Changes to the core logic should be made within the `packages/core` directory.
