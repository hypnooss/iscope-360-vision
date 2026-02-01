

## Plano: Padronizar Tamanho de Fonte nos Cards de Categoria

### Causa Raiz

| Componente | Container | Classe de Fonte do Nome |
|------------|-----------|-------------------------|
| **CategorySection (Firewall)** | `<button>` nativo | `font-semibold text-foreground` (herda tamanho do body) |
| **ExternalDomainCategorySection** | `<Button variant="ghost">` | `font-semibold text-foreground` (herda `text-sm` do Button) |

O componente `Button` do shadcn aplica `text-sm` internamente, enquanto o `<button>` nativo herda o tamanho base (geralmente `text-base` = 16px).

---

### Solução

Padronizar explicitando o tamanho da fonte `text-sm` no nome da categoria em **ambos** os componentes:

#### Alteração 1 - `src/components/CategorySection.tsx` (linha 106)

**Antes:**
```tsx
<span className="font-semibold text-foreground">{config.displayName}</span>
```

**Depois:**
```tsx
<span className="text-sm font-semibold text-foreground">{config.displayName}</span>
```

#### Alteração 2 - `src/components/external-domain/ExternalDomainCategorySection.tsx` (linha 109)

**Antes:**
```tsx
<span className="font-semibold text-foreground">{config.displayName}</span>
```

**Depois:**
```tsx
<span className="text-sm font-semibold text-foreground">{config.displayName}</span>
```

---

### Resultado Esperado

Ambos os relatórios (Firewall e Domínio Externo) exibirão o nome da categoria com o mesmo tamanho de fonte (`text-sm` = 14px), garantindo consistência visual.

