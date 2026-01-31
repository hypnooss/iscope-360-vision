

# Plano: Aumentar Transparência do Background dos Cards de Categoria

## Alteração Proposta

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

Reduzir a opacidade do background de `/10` (10%) para `/5` (5%), tornando o fundo mais transparente:

| Categoria | Antes | Depois |
|-----------|-------|--------|
| **Segurança DNS** | `bg-cyan-600/10` | `bg-cyan-600/5` |
| **Infraestrutura de Email** | `bg-violet-500/10` | `bg-violet-500/5` |
| **SPF** | `bg-emerald-600/10` | `bg-emerald-600/5` |
| **DKIM** | `bg-pink-500/10` | `bg-pink-500/5` |
| **DMARC** | `bg-amber-500/10` | `bg-amber-500/5` |

## Código a Aplicar

```tsx
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Segurança DNS': { 
    bg: 'bg-cyan-600/5', 
    text: 'text-cyan-600', 
    border: 'border-cyan-600/30' 
  },
  'Infraestrutura de Email': { 
    bg: 'bg-violet-500/5', 
    text: 'text-violet-500', 
    border: 'border-violet-500/30' 
  },
  'Autenticação de Email - SPF': { 
    bg: 'bg-emerald-600/5', 
    text: 'text-emerald-600', 
    border: 'border-emerald-600/30' 
  },
  'Autenticação de Email - DKIM': { 
    bg: 'bg-pink-500/5', 
    text: 'text-pink-500', 
    border: 'border-pink-500/30' 
  },
  'Autenticação de Email - DMARC': { 
    bg: 'bg-amber-500/5', 
    text: 'text-amber-500', 
    border: 'border-amber-500/30' 
  },
};
```

## Escala de Transparência Tailwind

| Valor | Opacidade | Resultado Visual |
|-------|-----------|------------------|
| `/5` | 5% | Muito sutil (proposto) |
| `/10` | 10% | Sutil (atual) |
| `/15` | 15% | Moderado |
| `/20` | 20% | Mais visível |

## Arquivo a Modificar

`src/components/external-domain/ExternalDomainCategorySection.tsx` - Linhas 18-46

