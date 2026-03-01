

## Ajustes no Radar de Incidentes M365 Analyzer

### Arquivo alvo
`src/pages/m365/M365AnalyzerDashboardPage.tsx`

### 1. Remover botao "Bloquear"
Remover o botao `<Button variant="destructive">` com icone `Ban` e texto "Bloquear" (linhas 191-194).

### 2. Remover botao "Investigar"
Remover o botao `<Button variant="ghost">` com icone `Search` e texto "Investigar" (linhas 199-203).

### 3. Remover botao SOC Mode
Remover o botao toggle de modo compacto (SOC) no header (linhas 501-509). A variavel `compactMode` e o state podem permanecer (default false) sem impacto.

### 4. Botao "Detalhes" abre dialog com informacoes completas
- Adicionar estado `selectedInsight` ao componente `IncidentCard`
- Ao clicar em "Detalhes", abrir um `Dialog` mostrando:
  - Nome, severidade, descricao completa
  - Contagem de ocorrencias
  - Lista completa de usuarios afetados (`affectedUsers`)
  - Recomendacao
  - Metadados adicionais (`metadata`)
- O dialog sera inline no componente `IncidentCard` para simplicidade

### 5. Icone Lampada (Lightbulb) - micro explicacao
O tooltip na lampada ja existe (linhas 173-186) e mostra `insight.recommendation`. Vou ajustar para mostrar tambem uma micro-explicacao baseada na `description` do insight quando `recommendation` nao estiver disponivel, garantindo que sempre haja conteudo util no tooltip.

### Resumo visual do card apos mudancas
```text
[ Icon  Nome do Incidente               severity ]
  Activity 7 ocorrencias  Users 7 usuarios  Novo  Lightbulb
  [ Detalhes ]
```

Sem "Bloquear", sem "Investigar", sem botao SOC no header.
