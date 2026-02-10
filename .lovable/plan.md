

# Card de Infraestrutura Diferenciado

## Objetivo

Separar o card de Infraestrutura dos Module Health Cards, pois ele atende todos os modulos e nao e um modulo de seguranca com score. Ele deve ter um layout proprio, similar ao da imagem de referencia, com metricas em lista.

## Layout do card

```text
+----------------------------------------+
| [Server icon]  Infraestrutura          |
|                                        |
|  * Agents          10/10 online        |
|  * Total de ativos            42       |
|  * Ultimo scan       ha cerca de 10h   |
+----------------------------------------+
```

- Card com borda superior (em vez de lateral) em `emerald-500` para diferenciar visualmente
- Sem ScoreGauge -- usa metricas em linhas com indicadores visuais
- Indicador de status dos agents: bolinha verde (todos online), amarela (parcial), vermelha (nenhum)
- Ocupa toda a largura abaixo dos Module Health Cards (full-width)
- Clicavel, navega para `/agents`

## Alteracoes tecnicas

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

1. **Remover o card "agents" do array `moduleCards`** -- ele nao deve mais usar `ModuleHealthCard`

2. **Adicionar novo componente `InfrastructureCard`** (inline) com:
   - Header: icone `Server` + titulo "Infraestrutura"
   - 3 linhas de metricas:
     - Agents: bolinha colorida + `X/Y online`
     - Total de ativos: soma de firewalls + tenants + dominios
     - Ultimo scan: `formatDistanceToNow` do mais recente `lastAnalysisDate` entre todos os modulos
   - Borda superior emerald (`border-t-4 border-t-emerald-500`)

3. **Ajustar grid dos Module Health Cards** para considerar apenas os 3 modulos de seguranca (sem agents)

4. **Renderizar o `InfrastructureCard`** como secao separada abaixo dos Module Health Cards

### Dados necessarios (ja disponiveis no hook)

- `stats.agentsOnline` / `stats.agentsTotal` -- ja existem
- Total de ativos = `stats.firewall.assetCount + stats.m365.assetCount + stats.externalDomain.assetCount`
- Ultimo scan = `max(firewall.lastAnalysisDate, m365.lastAnalysisDate, externalDomain.lastAnalysisDate)` -- calculado no componente

Nenhuma alteracao no hook `useDashboardStats.ts` e necessaria.

### Resumo

| Arquivo | Acao |
|---------|------|
| `src/pages/GeneralDashboardPage.tsx` | Separar card Infraestrutura com layout proprio |

