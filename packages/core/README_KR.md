# @4lph4/nolog-core

[NoLog](https://github.com/4lph4-dvlp/NoLog) 프로젝트의 핵심 엔진입니다. 이 패키지는 NoLog에 맞춰 구성된 Notion 데이터베이스와 상호작용하기 위한 순수한 백엔드 호환 TypeScript SDK를 제공합니다.

이 라이브러리는 Notion API 호출 및 데이터 매핑 로직을 Next.js 프레젠테이션 계층에서 분리하여, Node.js 환경(예: NestJS, Express, 순수 Node.js 스크립트) 어디서든 NoLog 엔진을 사용할 수 있게 해줍니다.

## 설치 방법

```bash
npm install @4lph4/nolog-core
```

*(참고: Notion Integration Token과 Database ID를 미리 준비해 주세요.)*

## 주요 특징

- **순수 TypeScript:** React나 Next.js에 대한 의존성이 전혀 없습니다.
- **내장 타입 정의:** NoLog 프론트엔드에서 요구하는 정확한 `Post` 인터페이스를 제공합니다.
- **SDK 버그 우회:** 공식 `@notionhq/client` (v5.20)의 인라인 데이터베이스 관련 버그를 우회하기 위해 데이터베이스 쿼리 시 REST API 직접 호출 방식을 사용합니다.

## 사용법

### 1. 클라이언트 초기화

```typescript
import { NologClient } from '@4lph4/nolog-core';

const nolog = new NologClient({
  token: 'ntn_your_notion_integration_token',
  databaseId: 'your_notion_database_id',
  // 선택사항: 커스텀 fetch 옵션 전달 (예: Next.js 캐싱 용도)
  // fetchOptions: { next: { revalidate: 60 } }
});
```

### 2. 게시글 목록 불러오기

```typescript
async function fetchMyPosts() {
  // 매핑된 Post 객체 배열을 반환합니다.
  const posts = await nolog.getPosts();
  console.log(`총 ${posts.length}개의 공개된 게시글을 찾았습니다.`);
}
```

### 3. 단일 게시글 불러오기

```typescript
async function fetchSinglePost(pageId: string) {
  // Post 객체를 반환하며, 없거나 비공개일 경우 null을 반환합니다.
  const post = await nolog.getPost(pageId);
  console.log(post?.title);
}
```

### 4. 카테고리 목록 불러오기

```typescript
async function fetchUniqueCategories() {
  // 모든 게시글에서 사용된 고유한 카테고리 문자열 배열을 반환합니다.
  const categories = await nolog.getCategories();
  console.log(categories);
}
```

### 5. 블록(콘텐츠) 불러오기

```typescript
async function fetchPostContent(pageId: string) {
  // 렌더링을 위한 Notion Block 객체 배열을 반환합니다.
  const blocks = await nolog.getBlocks(pageId);
  console.log(blocks);
}
```

## 타입 정의

SDK는 매핑된 Notion 페이지를 나타내는 `Post` 인터페이스를 제공합니다:

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

## 기여하기

이 패키지는 NoLog 모노레포의 일부입니다. 핵심 로직에 대한 변경은 `packages/core` 디렉토리 내에서 이루어져야 합니다.
