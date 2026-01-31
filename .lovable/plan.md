

# Plano: Cores Mais Escuras para Cards de Categoria

## Alteração Proposta

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

Substituir as cores `400` (mais claras/vibrantes) pelas versões `500` ou `600` (mais escuras e sóbrias):

| Categoria | Cor Atual | Nova Cor | Resultado |
|-----------|-----------|----------|-----------|
| **Segurança DNS** | `cyan-400` | `cyan-600` | Cyan escuro |
| **Infraestrutura de Email** | `violet-400` | `violet-500` | Violeta médio |
| **SPF** | `emerald-400` | `emerald-600` | Verde escuro |
| **DKIM** | `pink-400` | `pink-500` | Rosa médio |
| **DMARC** | `amber-400` | `amber-500` | Âmbar médio |

## Código a Aplicar

```tsx
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Segurança DNS': { 
    bg: 'bg-cyan-600/10', 
    text: 'text-cyan-600', 
    border: 'border-cyan-600/30' 
  },
  'Infraestrutura de Email': { 
    bg: 'bg-violet-500/10', 
    text: 'text-violet-500', 
    border: 'border-violet-500/30' 
  },
  'Autenticação de Email - SPF': { 
    bg: 'bg-emerald-600/10', 
    text: 'text-emerald-600', 
    border: 'border-emerald-600/30' 
  },
  'Autenticação de Email - DKIM': { 
    bg: 'bg-pink-500/10', 
    text: 'text-pink-500', 
    border: 'border-pink-500/30' 
  },
  'Autenticação de Email - DMARC': { 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-500', 
    border: 'border-amber-500/30' 
  },
};
```

## Comparação Visual

| Variante | Luminosidade | Uso Recomendado |
|----------|--------------|-----------------|
| `400` | Alta (atual) | Destaques, badges, alertas |
| `500` | Média | Equilíbrio entre visibilidade e sobriedade |
| `600` | Baixa | Visual mais sóbrio/corporativo |

## Arquivo a Modificar

`src/components/external-domain/ExternalDomainCategorySection.tsx` - Linhas 18-46

