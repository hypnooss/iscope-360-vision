

# Fix: Remove "Titulo" Column and Color-code Technology Badges

## Problem
1. The "Titulo" column takes up space but provides little value -- removing it frees room for technologies.
2. Technology badges lost their visual identity after the grid change -- they need distinct colors per technology type.

## Changes

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**1. Remove the "Titulo" column entirely**
- Remove `<TableHead>Titulo</TableHead>` (line 333)
- Remove the corresponding `<TableCell>` for title (line 367)

**2. Restore technology badges with color coding**
- Remove the `grid-cols-2` constraint and `max-w-[180px]` limit -- with the Titulo column gone, there's plenty of space
- Return to `flex flex-wrap gap-1` layout for natural flow
- Add a color-mapping function that assigns distinct colors to common technology categories:
  - **Security/headers** (HSTS, CSP, X-Frame-Options): teal/cyan badges
  - **Web servers** (Nginx, Apache, IIS, LiteSpeed): blue badges
  - **Languages/runtimes** (PHP, Python, Node.js, Java): purple badges
  - **CMS/Frameworks** (WordPress, Nextcloud, React, Django): amber/orange badges
  - **Default/other**: neutral outline badges
- Show all technologies (remove the `.slice(0, 4)` limit) since there's now enough horizontal space
- Keep `truncate max-w-[120px]` on individual badges to handle very long names

**3. Color mapping helper function**
```typescript
function getTechBadgeColor(tech: string): string {
  const t = tech.toLowerCase();
  // Security headers
  if (['hsts', 'csp', 'x-frame-options', 'x-xss-protection'].some(k => t.includes(k)))
    return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  // Web servers
  if (['nginx', 'apache', 'iis', 'litespeed', 'caddy'].some(k => t.includes(k)))
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  // Languages/runtimes
  if (['php', 'python', 'node', 'java', 'ruby', 'asp.net', '.net'].some(k => t.includes(k)))
    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  // CMS/Frameworks
  if (['wordpress', 'nextcloud', 'drupal', 'joomla', 'react', 'angular', 'vue', 'django', 'laravel'].some(k => t.includes(k)))
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  // Default
  return '';
}
```

**4. Updated technologies cell**
```jsx
<TableCell className="text-xs">
  {row.ws.technologies?.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {row.ws.technologies.map((t, j) => (
        <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0 truncate max-w-[120px]", getTechBadgeColor(t))}>
          {t}
        </Badge>
      ))}
    </div>
  ) : '---'}
</TableCell>
```

## Result
- More horizontal space for URL and Technologies columns
- Each technology badge is color-coded by category, improving readability
- All technologies are visible without overflow truncation

