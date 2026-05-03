# NoLog Template Creation Guide

This guide covers how to create, customize, and integrate new templates into your NoLog project.

## 1. Directory Structure
Templates are located in `src/templates/`. To create a new one:
1. Create a folder: `src/templates/my-template/`.
2. Implement mandatory pages:
   - `Layout.tsx`
   - `HomePage.tsx`
   - `CategoryPage.tsx`
   - `PostPage.tsx`
   - `SearchPage.tsx`

## 2. Implementing Pages
All pages must accept props defined in your types.

### Layout Example
```tsx
export default function MyLayout({ children, categories }: { children: React.ReactNode, categories: string[] }) {
  return (
    <div className="layout-wrapper">
      <nav>{/* Your nav logic */}</nav>
      {children}
    </div>
  );
}
```

## 3. Registering the Template
1. Add your template name to `src/site.config.ts`.
2. Import your layout in `src/app/layout.tsx` and map it in the template routing logic.

## 4. Advanced Customization
- **Libraries**: You can install any npm package (e.g., `framer-motion`, `three.js`) using `npm install`.
- **Custom Widgets**: Place complex components in `src/templates/my-template/components/`.

## 5. Deployment
NoLog templates are fully compatible with Vercel's build process. Just ensure your code passes `npm run build` locally.
