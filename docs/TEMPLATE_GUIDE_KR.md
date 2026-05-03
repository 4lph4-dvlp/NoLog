# NoLog 템플릿 제작 가이드

NoLog 프로젝트에 새로운 템플릿을 생성, 커스터마이징하고 통합하는 방법을 안내합니다.

## 1. 디렉토리 구조
템플릿은 `src/templates/` 디렉토리에 위치합니다. 새로운 템플릿을 만들려면:
1. 폴더 생성: `src/templates/나의-템플릿/`
2. 필수 페이지 구현:
   - `Layout.tsx`
   - `HomePage.tsx`
   - `CategoryPage.tsx`
   - `PostPage.tsx`
   - `SearchPage.tsx`

## 2. 페이지 구현
모든 페이지는 프로젝트의 타입 정의를 준수해야 합니다.

### 레이아웃 예시
```tsx
export default function MyLayout({ children, categories }: { children: React.ReactNode, categories: string[] }) {
  return (
    <div className="layout-wrapper">
      <nav>{/* 네비게이션 로직 */}</nav>
      {children}
    </div>
  );
}
```

## 3. 템플릿 등록
1. `src/site.config.ts`에 템플릿 이름을 추가합니다.
2. `src/app/layout.tsx`에서 레이아웃을 임포트하고, 템플릿 라우팅 로직에 매핑합니다.

## 4. 고급 커스터마이징
- **라이브러리**: `npm install`을 사용하여 외부 라이브러리(`framer-motion`, `three.js` 등)를 자유롭게 설치할 수 있습니다.
- **사용자 지정 위젯**: 복잡한 컴포넌트는 `src/templates/나의-템플릿/components/`에 배치하여 관리하세요.

## 5. 배포
NoLog 템플릿은 Vercel 빌드 프로세스와 완벽하게 호환됩니다. 배포 전 로컬에서 `npm run build`가 성공하는지 확인하세요.
