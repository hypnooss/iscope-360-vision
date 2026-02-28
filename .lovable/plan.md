

## Plano: Alinhar ícone com a linha do título

### Problema
Com `items-center` no container externo, o ícone se centraliza em relação a **todo** o conteúdo (título + descrição + recomendação), ficando deslocado para baixo. O desejado é que o ícone fique centralizado apenas com a **primeira linha** (título + badge).

### Solução
Em `src/components/compliance/UnifiedComplianceCard.tsx`:

1. Voltar `items-center` → `items-start` nos dois containers flex (linhas 210-211) para que o ícone fique no topo
2. Adicionar `self-center` no container do ícone em relação à primeira linha — na verdade, a abordagem mais limpa é: separar a primeira linha (ícone + título + badge) do resto (descrição, recomendação) em dois blocos distintos:
   - **Linha 1**: flex row com `items-center` contendo o ícone + título + badge
   - **Abaixo**: descrição, recomendação, entidades afetadas (fora do flex row do ícone)

Estrutura resultante:
```text
┌─────────────────────────────────────────┐
│ [ícone] Título do Check        [Badge]  │  ← flex items-center (só esta linha)
│                                         │
│ Descrição contextual do check...        │  ← fora do flex do ícone
│ > Recomendação                          │
│ > Detalhes                              │
└─────────────────────────────────────────┘
```

### Mudança concreta
Reestruturar o JSX das linhas ~209-260: mover a descrição (`contextualMessage`), recomendação, e entidades afetadas para **fora** do div que contém o ícone, mantendo apenas título+badge no mesmo nível do ícone.

### Arquivo editado (1)
- `src/components/compliance/UnifiedComplianceCard.tsx`

