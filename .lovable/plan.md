

## Ajustes Cirurgicos no Radar de Incidentes M365

### Arquivo unico: `src/pages/m365/M365AnalyzerDashboardPage.tsx`

Todas as mudancas sao neste arquivo. Nenhum arquivo novo sera criado.

---

### 1. Compactar IncidentCard (linhas 85-151)

- Reduzir padding de `p-4` para `p-3` e `space-y-3` para `space-y-1.5`
- Remover `insight.description` do corpo (linha 106) - mover para tooltip no hover do nome
- Remover bloco de `insight.recommendation` (linhas 126-130) - substituir por icone com tooltip
- Truncar nome em 1 linha (ja tem `truncate`)
- Manter: nome, badge severidade, contagem ocorrencias, usuarios afetados

### 2. Filtrar itens configuracionais

- Adicionar lista de nomes de insights a ignorar (ex: "Mailbox Intelligence desabilitado", "Filtro Anti-Spam com acao fraca")
- Filtrar `operationalInsights` e `anomalyInsights` para excluir insights cujo `name` contenha palavras-chave configuracionais como "desabilitado", "disabled", "configuracao", "policy"
- Aplicar filtro baseado em heuristica: se `count === 0` e nao tem `affectedUsers`, remover

### 3. Layout em 3 colunas por severidade (linhas 557-583)

Substituir a grid vertical unica por 3 colunas lado a lado:

```text
| Critical (col 1) | High (col 2) | Medium (col 3) |
```

- Usar `grid grid-cols-1 md:grid-cols-3 gap-4`
- Cada coluna tera header com icone + label + contagem
- Dentro de cada coluna, listar cards daquela severidade
- Remover o filtro por badge clicavel (ja nao e necessario com colunas)
- Manter estado `severityFilter` apenas para highlight

### 4. Peso visual para Critical

- Adicionar `animate-pulse` sutil no icone do card critical (nao no card inteiro)
- Aumentar badge de severidade para critical: `text-xs` -> `text-sm font-bold`
- Fundo diferenciado: `bg-rose-500/5` no card inteiro
- Glow ja existe (`shadow-[0_0_12px...]`), manter

### 5. Hierarquia de acoes (linhas 132-147)

- Botao principal (Bloquear Login): usar `variant="destructive" size="sm"` em vez de `ghost`
- Botoes secundarios (Ver Detalhes, Investigar): manter `variant="ghost"`
- Reordenar: acao primaria primeiro

### 6. Indicador de tendencia no card

- Adicionar no `IncidentCard` um mini indicador comparativo
- Usar `metadata.previousCount` se disponivel, senao mostrar "Novo" se nao havia antes
- Formato compacto: `+3 vs anterior` com seta

### 7. Bloco "Risco Atual" (linhas 483-544)

Substituir o `ScoreGauge` circular por layout textual direto:

```text
Risco Atual: ALTO
Score: 74/100  |  ↑ 12% vs anterior
[Critical: 2] [High: 5] [Medium: 8]
```

- Manter os badges de severidade como filtros clicaveis
- Remover o componente `ScoreGauge` circular
- Calcular nivel textual: 0-30 = BAIXO (verde), 31-60 = MODERADO (amarelo), 61-80 = ALTO (laranja), 81-100 = CRITICO (vermelho)

### 8. Tabs para separar Incidentes / Anomalias / Movimento Externo

- Adicionar `Tabs` do radix-ui (ja instalado) envolvendo as 3 secoes
- Tab "Incidentes" = secao 3 (colunas por severidade)
- Tab "Anomalias" = secao 4 (anomalias comportamentais)
- Tab "Movimento Externo" = secao 5 (rankings)
- Reduz scroll vertical significativamente

### 9. Remover texto verde de recomendacao

- Linha 126-130: remover o bloco `bg-primary/5` com recomendacao
- Substituir por icone `💡` com `Tooltip` que mostra a recomendacao no hover
- Importar `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` (ja disponivel)

---

### Resumo visual do resultado

```text
[Header: Tenant | Status | Ultima coleta | Executar | Config | SOC mode]

[Risco: ALTO - 74/100 - ↑12% vs anterior]
[Critical: 2] [High: 5] [Medium: 8]

[Tabs: Incidentes | Anomalias | Movimento Externo]

Tab Incidentes:
| 🔴 Critical (2)     | 🟠 High (5)         | 🟡 Medium (8)       |
| Card compacto        | Card compacto        | Card compacto        |
| Card compacto        | Card compacto        | Card compacto        |
```

### Estimativa

Todas as mudancas sao no mesmo arquivo (~755 linhas). O resultado final tera tamanho similar pois estamos compactando cards e movendo conteudo para tooltips/tabs.

