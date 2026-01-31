

# Plano: Ajustes Visuais no Componente de Categorias

## Objetivo

Aplicar três ajustes visuais no componente `ExternalDomainCategorySection.tsx`:

1. Remover o texto "aprovação" abaixo da pontuação
2. Diminuir o tamanho da fonte da pontuação
3. Diversificar as cores das categorias

---

## Alterações Detalhadas

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

### 1. Remover texto "aprovação"

**Linha 117 - Remover:**
```typescript
<p className="text-xs text-muted-foreground">aprovação</p>
```

### 2. Diminuir tamanho da fonte

**Linha 114 - Alterar de:**
```typescript
<span className={`text-2xl font-bold tabular-nums ${getPassRateColor(category.passRate)}`}>
```

**Para:**
```typescript
<span className={`text-lg font-semibold tabular-nums ${getPassRateColor(category.passRate)}`}>
```

### 3. Diversificar cores das categorias

**Linhas 19-44 - Novo mapa de cores mais distintas:**

| Categoria | Cor Atual | Nova Cor |
|-----------|-----------|----------|
| SPF | blue-500 | sky-500 |
| DKIM | cyan-500 | blue-500 |
| DMARC | indigo-500 | violet-500 |
| Segurança DNS | emerald-500 | teal-500 |
| Infraestrutura de Email | violet-500 | purple-500 |

```typescript
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Autenticação de Email - SPF': { 
    bg: 'bg-sky-500/10', 
    text: 'text-sky-500', 
    border: 'border-sky-500/30' 
  },
  'Autenticação de Email - DKIM': { 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-500', 
    border: 'border-blue-500/30' 
  },
  'Autenticação de Email - DMARC': { 
    bg: 'bg-violet-500/10', 
    text: 'text-violet-500', 
    border: 'border-violet-500/30' 
  },
  'Segurança DNS': { 
    bg: 'bg-teal-500/10', 
    text: 'text-teal-500', 
    border: 'border-teal-500/30' 
  },
  'Infraestrutura de Email': { 
    bg: 'bg-purple-500/10', 
    text: 'text-purple-500', 
    border: 'border-purple-500/30' 
  },
};
```

---

## Resultado Visual Esperado

**Antes:**
```
[Segurança DNS]                    50%
                                   aprovação
```

**Depois:**
```
[Segurança DNS]                    50%
```

- Porcentagem menor e mais elegante
- Sem o texto "aprovação" redundante
- Cores mais distintas entre as 5 categorias

---

## Arquivo a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Remover texto "aprovação", diminuir fonte, diversificar cores |

