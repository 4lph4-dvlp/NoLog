# NoLog Template Creation Guide

This guide provides a comprehensive overview of how to create, customize, and integrate new templates into the NoLog project.

## 1. Directory Structure
Templates are located in `src/templates/`. To add a new template, create a directory with your template name:

```text
src/templates/
└── my-awesome-template/
    ├── components/    # Reusable template-specific widgets
    ├── HomePage.tsx   # Mandatory: Blog index
    ├── CategoryPage.tsx # Mandatory: Category archive
    ├── PostPage.tsx   # Mandatory: Single post view
    ├── SearchPage.tsx # Mandatory: Search results
    └── Layout.tsx     # Mandatory: Main wrapper
```

## 2. Mandatory Pages & Props
Each page must implement specific interfaces to receive data from the Notion backend.

### Required Props
- **HomePage**: `{ posts: Post[], categories: string[] }`
- **CategoryPage**: `{ posts: Post[], displayName: string, categories: string[] }`
- **PostPage**: `{ post: Post, recordMap: any, categories: string[], relatedPosts: Post[] }`
- **SearchPage**: `{ posts: Post[], query: string, categories: string[] }`

### Layout Wrapper Example
The layout is your primary way to control global styles and navigation.
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

## 3. Registering the Template
To make your template available to the application:

1. **Config**: Update `src/site.config.ts` to include your new template name in the `template` key.
2. **Routing**: Import your new template's `Layout.tsx` in `src/app/layout.tsx` and map it in the template selection logic:
```tsx
let TemplateLayout = DefaultLayout;
if (CONFIG.template === "my-awesome-template") {
  TemplateLayout = MyLayout;
}
```

## 4. Advanced Customization & Vercel
- **Installing Libraries**: You can add dependencies directly via `npm install <package>`. These will be automatically picked up by Vercel during the build process.
- **Styling**: We recommend using **Tailwind CSS**. To ensure dark/light mode support, use semantic variables defined in `src/app/globals.css` (e.g., `--terminal-bg`, `--terminal-text`) or the standard semantic variables used in the Default template (e.g., `--background`, `--text-primary`).
- **Data Integration**: Use `getPost`, `getPosts`, and `getCategories` from `src/lib/notion.ts` to fetch your content. These functions are cached automatically.

## 5. Deployment Checklist
- [ ] Ensure all 5 mandatory pages are implemented.
- [ ] Verify `npm run build` passes locally.
- [ ] Confirm your template handles theme variables (check `globals.css` for semantic color definitions).
