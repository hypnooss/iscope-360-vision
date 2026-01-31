

# Plano: Ajuste de Cores no Header e Categorias

## Alterações Solicitadas

1. **MiniStat "TOTAL"**: Mudar de teal (primary) para **azul** (sky)
2. **MiniStat "APROVADAS"**: Mudar de azul (sky) para **teal** (primary)
3. **Cores das Categorias**: Escolher cores mais vibrantes e distintas

---

## Parte 1: Trocar Cores TOTAL e APROVADAS

### Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

**Linhas 48-62** - Inverter as variantes:

```tsx
// ANTES:
primary: {
  text: "text-primary",
  border: "border-primary/30",
  bg: "bg-primary/10"
},
success: {
  text: "text-sky-400",
  border: "border-sky-500/30",
  bg: "bg-sky-500/10"
},

// DEPOIS:
primary: {
  text: "text-sky-400",         // Azul para TOTAL
  border: "border-sky-500/30",
  bg: "bg-sky-500/10"
},
success: {
  text: "text-primary",         // Teal para APROVADAS
  border: "border-primary/30",
  bg: "bg-primary/10"
},
```

---

## Parte 2: Nova Paleta de Cores para Categorias

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

Escolhi cores mais saturadas e vibrantes, mantendo distinção visual entre elas:

| Categoria | Cor Atual | Nova Cor | Descrição |
|-----------|-----------|----------|-----------|
| **Segurança DNS** | `#C58CA7` (rosa apagado) | `#22D3EE` | Cyan vibrante |
| **Infraestrutura de Email** | `#6273C3` (azul apagado) | `#A78BFA` | Violeta luminoso |
| **SPF** | `#5A84A0` (azul acinzentado) | `#34D399` | Verde esmeralda |
| **DKIM** | `#8A6FAE` (lilás apagado) | `#F472B6` | Rosa vibrante |
| **DMARC** | `#5DAA9A` (verde apagado) | `#FACC15` | Amarelo dourado |

```tsx
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Segurança DNS': { 
    bg: 'bg-cyan-400/10', 
    text: 'text-cyan-400', 
    border: 'border-cyan-400/30' 
  },
  'Infraestrutura de Email': { 
    bg: 'bg-violet-400/10', 
    text: 'text-violet-400', 
    border: 'border-violet-400/30' 
  },
  'Autenticação de Email - SPF': { 
    bg: 'bg-emerald-400/10', 
    text: 'text-emerald-400', 
    border: 'border-emerald-400/30' 
  },
  'Autenticação de Email - DKIM': { 
    bg: 'bg-pink-400/10', 
    text: 'text-pink-400', 
    border: 'border-pink-400/30' 
  },
  'Autenticação de Email - DMARC': { 
    bg: 'bg-amber-400/10', 
    text: 'text-amber-400', 
    border: 'border-amber-400/30' 
  },
};
```

---

## Justificativa das Cores Escolhidas

- **Cyan (DNS)**: Representa conectividade/rede, alto contraste no dark mode
- **Violet (Email Infra)**: Elegante, destaca infraestrutura
- **Emerald (SPF)**: Verde vibrante para "verificação"
- **Pink (DKIM)**: Distintivo, cor quente para chaves/criptografia
- **Amber (DMARC)**: Dourado para "políticas", alta visibilidade

Todas as cores usam a variante `400` do Tailwind, que tem saturação mais alta que as versões `500` em backgrounds escuros.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` | Trocar cores das variantes primary/success |
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Nova paleta de cores para categorias |

---

## Resultado Visual Esperado

### Header MiniStats
| Card | Antes | Depois |
|------|-------|--------|
| TOTAL | Teal (primary) | Azul (sky) |
| APROVADAS | Azul (sky) | Teal (primary) |
| FALHAS | Rosa (rose) | Rosa (sem alteração) |

### Categorias
Cores mais vibrantes e saturadas, com alta distinção visual entre cada uma.

