
## Plano: Corrigir Efeitos de Hover e Padronizar Fontes nos Cards de Compliance

### Contexto

Três problemas identificados:

1. **Hover não funciona em todas as categorias** - O mapa `CATEGORY_HOVER_CLASSES` em `ComplianceCard.tsx` só contém 6 cores, mas o sistema usa 14 cores diferentes
2. **CategorySection não passa a cor da categoria** - O componente não envia `categoryColorKey` para `ComplianceCard`
3. **Tamanhos de fonte inconsistentes** - Precisam ser padronizados

---

### Problema 1: Mapa de Cores de Hover Incompleto

**Arquivo:** `src/components/ComplianceCard.tsx`

**Situação Atual (linhas 18-25):**
```typescript
const CATEGORY_HOVER_CLASSES: Record<string, { border: string; text: string }> = {
  'sky-500': { border: 'hover:border-sky-500/50', text: 'group-hover:text-sky-500' },
  'blue-500': { border: 'hover:border-blue-500/50', text: 'group-hover:text-blue-500' },
  'violet-500': { border: 'hover:border-violet-500/50', text: 'group-hover:text-violet-500' },
  'teal-500': { border: 'hover:border-teal-500/50', text: 'group-hover:text-teal-500' },
  'purple-500': { border: 'hover:border-purple-500/50', text: 'group-hover:text-purple-500' },
  'slate-500': { border: 'hover:border-slate-500/50', text: 'group-hover:text-slate-500' },
};
```

**Solução:** Adicionar TODAS as cores definidas em `AVAILABLE_COLORS`:

```typescript
const CATEGORY_HOVER_CLASSES: Record<string, { border: string; text: string }> = {
  // Cores originais
  'sky-500': { border: 'hover:border-sky-500/50', text: 'group-hover:text-sky-500' },
  'blue-500': { border: 'hover:border-blue-500/50', text: 'group-hover:text-blue-500' },
  'violet-500': { border: 'hover:border-violet-500/50', text: 'group-hover:text-violet-500' },
  'teal-500': { border: 'hover:border-teal-500/50', text: 'group-hover:text-teal-500' },
  'purple-500': { border: 'hover:border-purple-500/50', text: 'group-hover:text-purple-500' },
  'slate-500': { border: 'hover:border-slate-500/50', text: 'group-hover:text-slate-500' },
  // Cores adicionais do AVAILABLE_COLORS
  'cyan-600': { border: 'hover:border-cyan-600/50', text: 'group-hover:text-cyan-600' },
  'emerald-600': { border: 'hover:border-emerald-600/50', text: 'group-hover:text-emerald-600' },
  'pink-500': { border: 'hover:border-pink-500/50', text: 'group-hover:text-pink-500' },
  'amber-500': { border: 'hover:border-amber-500/50', text: 'group-hover:text-amber-500' },
  'red-500': { border: 'hover:border-red-500/50', text: 'group-hover:text-red-500' },
  'green-500': { border: 'hover:border-green-500/50', text: 'group-hover:text-green-500' },
  'orange-500': { border: 'hover:border-orange-500/50', text: 'group-hover:text-orange-500' },
  'indigo-500': { border: 'hover:border-indigo-500/50', text: 'group-hover:text-indigo-500' },
  'rose-500': { border: 'hover:border-rose-500/50', text: 'group-hover:text-rose-500' },
};
```

---

### Problema 2: CategorySection Não Passa Cor

**Arquivo:** `src/components/CategorySection.tsx`

**Situação Atual (linha 160):**
```tsx
<ComplianceCard key={check.id} check={check} variant={variant} />
```

**Solução:** Passar `categoryColorKey`:

```tsx
<ComplianceCard 
  key={check.id} 
  check={check} 
  variant={variant} 
  categoryColorKey={config.color}
/>
```

---

### Problema 3: Padronização de Tamanho de Fonte

**Comparação dos Componentes:**

| Elemento | CategorySection | ExternalDomainCategorySection |
|----------|-----------------|-------------------------------|
| Nome categoria | `font-semibold text-foreground` | `font-semibold text-foreground` |
| Percentual | `text-lg font-semibold` | `text-lg font-semibold` |
| Badges | `text-xs` | `text-xs` |

Os tamanhos de fonte já estão padronizados entre os componentes. Nenhuma alteração necessária.

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ComplianceCard.tsx` | Adicionar 9 cores faltantes ao mapa `CATEGORY_HOVER_CLASSES` |
| `src/components/CategorySection.tsx` | Passar `categoryColorKey={config.color}` para `ComplianceCard` |

---

### Resultado Esperado

1. **Hover funcionando em todas as categorias**: Ao passar o mouse sobre qualquer card de item, a borda e a seta mudarão para a cor da categoria pai
2. **Consistência visual**: Tanto Firewall quanto Domínio Externo terão o mesmo comportamento de hover
3. **Cores suportadas**: Todas as 14 cores do sistema terão efeitos de hover definidos
