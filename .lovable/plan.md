

# Ocultar licencas M365 "Suspended" e mover indicador para cima da tabela

## Alteracoes em `src/pages/LicensingHubPage.tsx`

### 1. Incluir licencas com `capabilityStatus === 'Suspended'` na ocultacao

No `useMemo` que calcula `visibleM365` e `hiddenM365Count` (linha ~156), adicionar a condicao de `Suspended` junto com a de expiradas > 60 dias:

```
const shouldHide = (lic) =>
  lic.capabilityStatus === 'Suspended' ||
  (lic.daysLeft !== null && lic.daysLeft < -60);
```

- Licencas `Suspended` serao ocultadas por padrao, independente da data
- Licencas expiradas ha mais de 60 dias continuam ocultadas
- O texto sutil sera atualizado para refletir ambos os casos: "X licenca(s) oculta(s) (suspensas ou expiradas ha mais de 60 dias)"

### 2. Mover o indicador sutil para cima da tabela

Mover o bloco do botao toggle (atualmente em linhas 426-439, abaixo da tabela) para antes da tabela, logo apos o botao "Atualizar Licencas" (linha ~374). Ficara entre o header de acoes e a tabela, mantendo o layout limpo.

### 3. Excluir licencas ocultas dos contadores dos cards

No `useMemo` de `displaySummary` (aba m365, linha ~130), filtrar tambem as licencas `Suspended` e expiradas > 60 dias para que nao inflem os contadores dos cards de resumo.

### Arquivo alterado

| Arquivo | Alteracao |
|---|---|
| `src/pages/LicensingHubPage.tsx` | Adicionar filtro `Suspended` na ocultacao, mover indicador para cima da tabela, ajustar contadores |

