
# Fix: Estado colapsado do sidebar nao persiste entre navegacoes

## Problema

O estado do sidebar (`sidebarOpen`) e gerenciado com `useState(true)` no componente `AppLayout`. Quando o usuario navega para outra pagina (via Link ou navigate), o componente pode ser remontado e o estado volta para `true` (expandido), perdendo a preferencia do usuario.

## Solucao

Persistir o estado do sidebar no `localStorage`. Ao montar o componente, ler o valor salvo; ao alterar, gravar no `localStorage`.

## Alteracoes

### Arquivo: `src/components/layout/AppLayout.tsx`

**Linha ~175** - Substituir o `useState(true)` por uma inicializacao que le do `localStorage`:

```tsx
const [sidebarOpen, setSidebarOpen] = useState(() => {
  const saved = localStorage.getItem('sidebar-open');
  return saved !== null ? saved === 'true' : true;
});
```

**Adicionar um `useEffect`** logo apos o useState para persistir alteracoes:

```tsx
useEffect(() => {
  localStorage.setItem('sidebar-open', String(sidebarOpen));
}, [sidebarOpen]);
```

Nenhuma outra alteracao necessaria. Todos os pontos que chamam `setSidebarOpen` continuam funcionando normalmente.

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/layout/AppLayout.tsx` | Persistir `sidebarOpen` no localStorage (inicializacao + useEffect) |
