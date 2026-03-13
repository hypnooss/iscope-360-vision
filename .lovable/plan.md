

## Alterar cor do número "Desabilitados" na sheet

### Alteração

**`src/components/m365/entra-id/EntraIdCategorySheet.tsx`** — no `case 'active_users'`, mudar a cor do MetricCard "Desabilitados" de `text-red-500` para `text-indigo-500` (equivalente ao `#6366f1` usado no card do grid).

```tsx
// De:
<MetricCard label="Desabilitados" value={users.disabled} color="text-red-500" icon={UserX} />

// Para:
<MetricCard label="Desabilitados" value={users.disabled} color="text-indigo-500" icon={UserX} />
```

