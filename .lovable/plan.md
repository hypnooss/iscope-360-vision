
# Plano: Cores do Item Seguindo a Categoria

## Problema Identificado

Atualmente no `ComplianceCard`:
- A borda do item usa `hover:border-primary/50` (verde-água genérico)
- O ícone ">" do botão "Detalhes" usa `text-primary` no hover

Isso quebra o efeito visual de pertencimento, pois a categoria "Infraestrutura de Email" usa roxo (`purple-500`), mas os itens dentro dela usam verde-água.

---

## Solução Proposta

Passar a cor da categoria como prop para o `ComplianceCard`, permitindo que a borda e o ícone sigam a cor da seção pai.

---

## Alterações

### 1. `ExternalDomainCategorySection.tsx`

Passar a cor da categoria para cada `ComplianceCard`:

```tsx
// Linha 152-154
{category.checks.map((check) => (
  <ComplianceCard 
    key={check.id} 
    check={check} 
    variant="external_domain"
    categoryColor={colors.text}  // ex: "text-purple-500"
  />
))}
```

---

### 2. `ComplianceCard.tsx`

**Adicionar nova prop:**

```tsx
interface ComplianceCardProps {
  check: ComplianceCheck;
  onClick?: () => void;
  variant?: 'default' | 'external_domain';
  categoryColor?: string;  // Nova prop (ex: "text-purple-500")
}
```

**Extrair a cor base para usar na borda:**

```tsx
// Função helper para extrair cor base (ex: "text-purple-500" -> "purple-500")
const extractColorBase = (textClass?: string) => {
  if (!textClass) return null;
  const match = textClass.match(/text-(\w+-\d+)/);
  return match ? match[1] : null;
};

const colorBase = extractColorBase(categoryColor);
```

**Aplicar na borda do card (linha 67):**

```tsx
<div 
  className={cn(
    "glass-card rounded-lg p-4 transition-all duration-200 group animate-fade-in",
    colorBase 
      ? `hover:border-${colorBase}/50` 
      : "hover:border-primary/50"
  )}
>
```

**Aplicar no chevron "Detalhes" (linha 108):**

```tsx
<ChevronRight 
  className={cn(
    "w-5 h-5 text-muted-foreground transition-colors",
    colorBase 
      ? `group-hover:text-${colorBase}` 
      : "group-hover:text-primary"
  )}
/>
```

---

## Problema: Classes Dinâmicas no Tailwind

O Tailwind não suporta classes dinâmicas como `hover:border-${colorBase}/50` pois ele faz purge no build.

**Solução**: Passar as classes completas como props:

```tsx
interface ComplianceCardProps {
  // ...
  categoryBorderClass?: string;  // ex: "hover:border-purple-500/50"
  categoryTextClass?: string;    // ex: "group-hover:text-purple-500"
}
```

E no `ExternalDomainCategorySection`:

```tsx
<ComplianceCard 
  key={check.id} 
  check={check} 
  variant="external_domain"
  categoryBorderClass={`hover:border-${colors.text.replace('text-', '')}/50`}
  categoryTextClass={`group-hover:${colors.text}`}
/>
```

**Ou criar um mapa de cores** no `ComplianceCard`:

```tsx
const CATEGORY_HOVER_CLASSES: Record<string, { border: string; text: string }> = {
  'sky-500': { border: 'hover:border-sky-500/50', text: 'group-hover:text-sky-500' },
  'blue-500': { border: 'hover:border-blue-500/50', text: 'group-hover:text-blue-500' },
  'violet-500': { border: 'hover:border-violet-500/50', text: 'group-hover:text-violet-500' },
  'teal-500': { border: 'hover:border-teal-500/50', text: 'group-hover:text-teal-500' },
  'purple-500': { border: 'hover:border-purple-500/50', text: 'group-hover:text-purple-500' },
};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ComplianceCard.tsx` | Adicionar props de cor e aplicar na borda/chevron |
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Passar cor da categoria para `ComplianceCard` |

---

## Resultado Visual

| Elemento | Antes | Depois |
|----------|-------|--------|
| Borda do item (hover) | Verde-água genérico | Roxo (cor da categoria) |
| Ícone ">" Detalhes | Verde-água | Roxo (cor da categoria) |

Assim, cada item terá visual coerente com sua seção pai, reforçando o pertencimento.
