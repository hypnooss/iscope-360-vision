

## Improve Config Change Visualization for `user.group` and `router.access-list`

### Problem 1: `user.group` — No add/remove context for members

The screenshot shows `cfgattr` like `001 : ny.magalhaes andreia.alvos ...` rendered as chips without any indication of whether members were added or removed. For `Edit` actions on `user.group`, the FortiOS log doesn't provide old→new diffs for the member list, but we can improve clarity by:

- Adding a dedicated `user.group` handler in `formatByPath` (before the generic `user.*` catch-all)
- Parsing the numbered prefix (e.g. `001`) as the group ID
- Labeling the member list contextually based on action: "Membros adicionados" (Add), "Membros removidos" (Delete), "Membros (lista atual)" (Edit)
- Rendering members as green chips (Add), red chips (Delete), or neutral chips (Edit) using distinct colors

### Problem 2: `router.access-list` — Nested brackets shown raw

The raw data `rule:3[prefix[wildcard[192.168.0.0 0.0.0.255]flags[4]]]` is parsed by `parseFieldBracketFormat` but nested brackets produce unreadable output like `prefix[wildcard[192.168.0.0 0.0.0.255]flags[4]]`.

Fix: Add a dedicated `router.access-list` handler that:
- Extracts `rule:N` as the entry identifier
- Recursively flattens nested brackets into readable key-value pairs: `prefix → 192.168.0.0`, `wildcard → 0.0.0.255`, `flags → 4`
- Renders each extracted field as a clean row instead of raw bracket soup

### File changed

| File | Change |
|---|---|
| `src/pages/firewall/AnalyzerConfigChangesPage.tsx` | Add `parseUserGroupFormat` and `parseRouterAccessListFormat` functions; update `formatByPath` dispatcher; update renderer to support colored chip variants |

### Details

**New function `parseUserGroupFormat`** (~20 lines):
```typescript
function parseUserGroupFormat(raw: string, action: string): ParsedChange[] {
  // Strip numbered prefix "001 : " or "[001]: "
  const cleaned = raw.replace(/^\[?\d+\]\s*:\s*/, '').trim();
  const members = cleaned.split(/\s+/).filter(Boolean);
  const label = action === 'Add' ? 'Membros adicionados'
    : action === 'Delete' || action === 'Del' ? 'Membros removidos'
    : 'Membros (lista atual)';
  // colorHint will be used by the renderer
  return [{ field: label, raw: members.join(' '), colorHint: action }];
}
```

**New function `parseRouterAccessListFormat`** (~30 lines):
- Recursively flatten nested `field[content]` into leaf key-value pairs
- e.g. `rule:3[prefix[wildcard[192.168.0.0 0.0.0.255]flags[4]]]` → entries: `rule → 3`, `prefix → 192.168.0.0`, `wildcard → 0.0.0.255`, `flags → 4`

**Updated `formatByPath` dispatcher** — Add two new cases before the generic `user.*` and `router.*` catches:
```typescript
if (path === 'user.group') return parseUserGroupFormat(cfgattr, action);
if (path === 'router.access-list') return parseRouterAccessListFormat(cfgattr);
```

**Updated renderer** — When `change.colorHint` exists, apply colored chip styling:
- `Add` → green chips (`bg-emerald-500/20 text-emerald-400`)
- `Delete`/`Del` → red chips (`bg-rose-500/20 text-rose-400 line-through`)
- `Edit` → neutral chips (current `bg-muted`)

