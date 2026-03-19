

## Persistir ordenação com localStorage

**Arquivo:** `src/components/environment/AssetCategorySection.tsx`

Usar o `title` da seção como chave para salvar/restaurar o estado de ordenação no `localStorage`.

### Alterações

1. Inicializar `sortKey` e `sortDir` lendo do `localStorage` com chave `env-sort-{title}`
2. No `handleSort`, salvar o novo estado no `localStorage` (ou remover a chave quando volta ao neutro)

```typescript
const storageKey = `env-sort-${title}`;

const [sortKey, setSortKey] = useState<SortKey | null>(() => {
  const saved = localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved).key : null;
});
const [sortDir, setSortDir] = useState<SortDir>(() => {
  const saved = localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved).dir : null;
});

const handleSort = (key: SortKey) => {
  let newKey: SortKey | null; let newDir: SortDir;
  if (sortKey !== key) { newKey = key; newDir = 'asc'; }
  else if (sortDir === 'asc') { newKey = key; newDir = 'desc'; }
  else { newKey = null; newDir = null; }
  setSortKey(newKey); setSortDir(newDir);
  if (newKey && newDir) localStorage.setItem(storageKey, JSON.stringify({ key: newKey, dir: newDir }));
  else localStorage.removeItem(storageKey);
};
```

Apenas este arquivo precisa ser alterado.

