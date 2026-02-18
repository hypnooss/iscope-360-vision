
# Ajuste de Espaçamento — Breadcrumb → Step Indicator

## Causa

O header removido anteriormente ocupava espaço visual entre a breadcrumb e o step indicator. Sem ele, o `space-y-6` do container pai gera apenas 24px de gap — pouco para separar adequadamente os dois elementos.

## Correção

No arquivo `src/pages/environment/AddFirewallPage.tsx`, linha 455, adicionar `mt-8` ao wrapper do `StepIndicator` para criar ~32px de espaçamento adicional entre a breadcrumb e o indicador de passos:

```tsx
// Antes:
{/* Step Indicator */}
<StepIndicator current={step} />

// Depois:
{/* Step Indicator */}
<div className="mt-8">
  <StepIndicator current={step} />
</div>
```

Isso aplica `margin-top: 2rem` (32px) **além** do `space-y-6` já existente, totalizando ~56px de separação — visualmente equivalente ao espaçamento que o header proporcionava antes de ser removido.

## Arquivo modificado

- `src/pages/environment/AddFirewallPage.tsx` — linha 455, wrap do `StepIndicator` com `<div className="mt-8">`
