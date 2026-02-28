

## Plano: Ajustar layout dos cards de Compliance

### Mudanças em `src/components/compliance/UnifiedComplianceCard.tsx`

1. **Alinhar descrição com o título** (linhas 224-228): Adicionar `ml-[calc(2rem+0.75rem+1rem)]` (padding do ícone 8px*2 + ícone 16px + gap 12px ≈ `ml-[3.25rem]`) ao parágrafo da descrição para que o texto comece na mesma posição vertical do título.
   - O ícone ocupa: `p-2` (8px cada lado) + `w-4` (16px) = 32px, mais o `gap-3` (12px) = 44px ≈ `ml-[2.75rem]`

2. **Remover recomendação dos cards fail** (linhas 230-235): Remover ou comentar o bloco que exibe `item.recommendation` no card. A recomendação continuará visível na sheet de detalhes.

### Arquivo editado (1)
- `src/components/compliance/UnifiedComplianceCard.tsx`

