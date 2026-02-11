

# Redesign dos Cards do Dashboard -- Layout Completo com Sparkline e Top CVEs

## Visao Geral

Redesenhar completamente os cards de saude dos modulos no Dashboard Geral, substituindo o ScoreGauge circular por um layout mais informativo e acionavel, inspirado no mockup proposto. O novo card inclui: barra de progresso horizontal com score, sparkline de evolucao historica (ultimos 30 dias), severidades de conformidade, top 2 CVEs e botoes de acao rapida.

## Novo Layout do Card

```text
+---------------------------------------------------------------+
| [icon] Firewall                    Ultima analise: ha 2 horas |
|                                                               |
|  Score ██████████████████░░░░ 78/100   [sparkline 30 dias]    |
|                                                               |
|  CONFORMIDADE                                                 |
|  [2] Critico  [5] Alto  [3] Medio  [1] Baixo                 |
|                                                               |
|  ALERTAS DE CVE                                               |
|  CVE-2026-1234  CVSS 9.8  CRITICAL                            |
|  CVE-2026-5678  CVSS 8.2  HIGH                                |
|                                                               |
|  [Conformidade]  [CVEs]                                       |
+---------------------------------------------------------------+
```

## Etapas de Implementacao

### 1. Expandir o Hook `useDashboardStats` para dados historicos

Adicionar ao tipo `ModuleHealth` um campo `scoreHistory` (array de `{ date: string, score: number }`), coletando ate 30 pontos historicos de cada tabela de analise:

- **Firewall**: `analysis_history` -- buscar scores agrupados por dia (ultimo de cada dia por firewall, media dos firewalls)
- **M365**: `m365_posture_history` -- mesmo padrao
- **Dominio Externo**: `external_domain_analysis_history` -- mesmo padrao

A query ja busca o historico ordenado por `created_at DESC`; a mudanca e **nao** parar no primeiro registro por asset, mas coletar todos e agregar por dia.

### 2. Criar hook `useTopCVEs` para os Top CVEs do Dashboard

Criar um novo hook leve (`src/hooks/useTopCVEs.ts`) que busca da `cve_severity_cache` os modulos com CVEs e, para cada um, chama as Edge Functions existentes (`fortigate-cve` e `m365-cves`) retornando apenas os top N CVEs por score. O hook utiliza `staleTime` longo (30 min) para nao impactar performance.

O retorno sera um `Record<string, TopCVE[]>` mapeando statsKey para os top 2 CVEs com: `id`, `score`, `severity`.

### 3. Adicionar rotas de CVE ao `moduleDashboardConfig`

Adicionar um campo `cvePath` ao config:
- `scope_firewall`: `/scope-firewall/cves`
- `scope_m365`: `/scope-m365/cves`
- `scope_external_domain`: sem CVEs (undefined)

### 4. Redesenhar o `ModuleHealthCard`

Substituir o layout atual pelo novo design:

**Header** (linha superior):
- Esquerda: icone + titulo do modulo
- Direita: texto "Ultima analise: ha X" + seta de navegacao

**Score + Sparkline** (segunda linha):
- Esquerda: barra de progresso horizontal com label "Score" e valor numerico (ex: `78/100`)
- Direita: mini sparkline (recharts `AreaChart` ou `LineChart`, ~120x40px) mostrando evolucao dos ultimos 30 dias
- Cores da barra seguem a classificacao existente (Excelente/Bom/Atencao/Critico)

**Conformidade** (terceira secao):
- Titulo "CONFORMIDADE" em uppercase
- Badges inline horizontais: `[count] Critico | [count] Alto | [count] Medio | [count] Baixo`
- Se todos zerados, mostra icone verde "Nenhum alerta"

**Top CVEs** (quarta secao, condicional):
- Titulo "ALERTAS DE CVE"
- Lista das 2 CVEs com maior score: ID, CVSS score, badge de severidade
- Se nao houver CVEs, secao nao aparece

**Acoes Rapidas** (footer):
- Botoes ghost/outline: "Conformidade" (navega para pagina do modulo) e "CVEs" (navega para pagina de CVEs)
- Para modulos sem CVE, apenas botao "Conformidade"

### 5. Componente Sparkline

Criar componente reutilizavel `src/components/dashboard/ScoreSparkline.tsx` usando recharts:
- `AreaChart` com gradiente da cor do modulo
- Sem eixos, sem legenda, sem tooltip (visual limpo)
- Tamanho fixo ~140x48px
- Mostra uma linha de referencia pontilhada no score atual

## Dependencias

- **recharts**: ja instalado no projeto
- **date-fns**: ja instalado
- Nenhuma nova dependencia necessaria

## Arquivos Modificados/Criados

| Arquivo | Acao |
|---|---|
| `src/hooks/useDashboardStats.ts` | Modificar: adicionar `scoreHistory` ao `ModuleHealth`, coletar historico por dia |
| `src/hooks/useTopCVEs.ts` | Criar: hook para buscar top 2 CVEs por modulo |
| `src/config/moduleDashboardConfig.ts` | Modificar: adicionar campo `cvePath` |
| `src/components/dashboard/ScoreSparkline.tsx` | Criar: componente sparkline com recharts |
| `src/pages/GeneralDashboardPage.tsx` | Modificar: redesenhar `ModuleHealthCard` com novo layout completo |

## Consideracoes de Performance

- O historico de scores busca apenas `score` e `created_at` (sem `report_data` no historico), minimizando payload
- Top CVEs usa cache com `staleTime: 30min` via React Query
- Sparkline renderiza no maximo 30 pontos (leve para recharts)
- As queries de historico rodam em paralelo com as queries existentes

