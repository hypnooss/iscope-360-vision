
# Centralizar Elementos nos Cards do Dashboard

## Objetivo

Ajustar o layout interno dos `ModuleHealthCard` para que o ScoreGauge, coluna de CVEs e coluna de Conformidade fiquem centralizados horizontalmente com espacamento uniforme entre eles e as bordas do card.

## Alteracao

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

**Linha 133** - Alterar o container do gauge + severidades:
- Trocar `flex items-center gap-4` por `flex items-center justify-evenly` para distribuir os elementos uniformemente
- Isso garante que o espaco entre borda esquerda, gauge, colunas de severidade e borda direita seja igual

**Linha 146** - Ajustar o container das colunas de severidade:
- Remover `flex-1` para que nao ocupe todo o espaco restante
- Manter `flex gap-4` (ou `gap-6`) para separacao entre as duas colunas

A mudanca principal e usar `justify-evenly` no container pai, que distribui os filhos com espacos iguais incluindo as bordas.

## Resultado Visual

```text
|     [Gauge]     [CVEs]     [Conformidade]     |
|<-- igual -->|<-- igual -->|<-- igual -->|<-- igual -->|
```

Para cards sem CVEs (Dominio Externo):
```text
|        [Gauge]        [Conformidade]        |
|<--- igual --->|<--- igual --->|<--- igual --->|
```

## Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/pages/GeneralDashboardPage.tsx` | `justify-evenly` no container, remover `flex-1` das colunas |
