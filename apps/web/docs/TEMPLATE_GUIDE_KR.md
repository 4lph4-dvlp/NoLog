# NoLog 템플릿 제작 가이드

이 가이드는 NoLog 프로젝트에 새로운 템플릿을 생성하고, 커스터마이징하며, 시스템에 통합하는 방법에 대한 포괄적인 정보를 제공합니다.

## 1. 디렉토리 구조
템플릿은 `src/templates/` 디렉토리에 위치합니다. 새로운 템플릿을 추가하려면 해당 위치에 템플릿 이름으로 폴더를 생성하세요:

```text
src/templates/
└── my-awesome-template/
    ├── components/      # 해당 템플릿 전용 위젯 (재사용 가능)
    ├── HomePage.tsx     # 필수: 블로그 메인 페이지
    ├── CategoryPage.tsx # 필수: 카테고리별 게시글 목록
    ├── PostPage.tsx     # 필수: 게시글 상세 보기
    ├── SearchPage.tsx   # 필수: 검색 결과 페이지
    └── Layout.tsx       # 필수: 전체 레이아웃 래퍼
```

## 2. 필수 페이지 및 Props
각 페이지는 Notion 백엔드로부터 데이터를 전달받기 위해 특정 인터페이스를 구현해야 합니다.

### 필수 Props 정의
- **HomePage**: `{ posts: Post[], categories: string[] }`
- **CategoryPage**: `{ posts: Post[], displayName: string, categories: string[] }`
- **PostPage**: `{ post: Post, recordMap: any, categories: string[], relatedPosts: Post[] }`
- **SearchPage**: `{ posts: Post[], query: string, categories: string[] }`

### 레이아웃 래퍼 예시
레이아웃은 전역 스타일과 네비게이션을 제어하는 핵심 컴포넌트입니다.
```tsx
export default function MyLayout({ children, categories }: { children: React.ReactNode, categories: string[] }) {
  return (
    <div className="bg-background text-foreground">
      <nav>...</nav>
      {children}
    </div>
  );
}
```

## 3. 템플릿 등록하기
새로 만든 템플릿을 애플리케이션에서 사용하려면 다음 단계를 따르세요:

1. **설정 업데이트**: `src/site.config.ts` 파일의 `template` 키에 새로 만든 템플릿 이름을 입력합니다.
2. **라우팅 연결**: `src/app/layout.tsx`에서 새로 만든 템플릿의 `Layout.tsx`를 임포트하고, 템플릿 선택 로직에 매핑합니다:
```tsx
let TemplateLayout = DefaultLayout;
if (CONFIG.template === "my-awesome-template") {
  TemplateLayout = MyLayout;
}
```

## 4. 고급 커스터마이징 및 Vercel 배포
- **라이브러리 설치**: `npm install <패키지명>`을 통해 필요한 라이브러리를 직접 추가할 수 있습니다. 추가된 의존성은 Vercel 빌드 프로세스 중에 자동으로 설치되고 반영됩니다.
- **스타일링**: **Tailwind CSS** 사용을 권장합니다. 다크/라이트 모드를 완벽하게 지원하려면 `src/app/globals.css`에 정의된 시맨틱 변수(예: `--terminal-bg`, `--terminal-text`)나 Default 템플릿의 표준 변수(예: `--background`, `--text-primary`)를 활용하세요.
- **데이터 연동**: 콘텐츠를 가져오기 위해 `src/lib/notion.ts`에 정의된 `getPost`, `getPosts`, `getCategories` 함수를 사용하세요. 이 함수들은 자동으로 캐싱 처리됩니다.

## 5. 배포 전 체크리스트
- [ ] 5개의 필수 페이지가 모두 구현되었는가?
- [ ] 로컬 환경에서 `npm run build`가 오류 없이 통과되는가?
- [ ] 테마 변수를 적절히 처리하여 다크/라이트 모드에서 가독성이 확보되었는가? (`globals.css` 확인)
