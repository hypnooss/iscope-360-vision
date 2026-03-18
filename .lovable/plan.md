

## Plan: Improve tenant displayName visibility in dropdown

The `displayName` text (line 75) uses `text-muted-foreground` which is nearly invisible on dark backgrounds, especially on the selected item with `bg-accent`.

### Change in `src/components/m365/posture/TenantSelector.tsx`

**Line 75**: Change the displayName styling from `text-xs text-muted-foreground` to `text-xs text-foreground/70` for better contrast. On the selected item, use a brighter color.

Update the displayName span (line 75) to use conditional styling:
```tsx
<span className={cn(
  "text-xs",
  tenant.id === selectedId ? "text-foreground/80" : "text-foreground/60"
)}>
  {tenant.displayName}
</span>
```

Single file, single change.

