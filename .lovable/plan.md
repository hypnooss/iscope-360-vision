

# Substituir badges de severidade por top categorias/tipos

## O que muda

Para os cards de **Filtragem Web**, **Controle de Apps** e **Anomalias**, as badges atualmente mostram severidade (Critical, High, Medium, Low). Vamos substituí-las por badges com os **top tipos/categorias reais** dos dados:

- **Web Filter** → top 2-3 de `metrics.topWebFilterCategories` (ex: "Malware", "Adult", "Gambling")
- **App Control** → top 2-3 de `metrics.topAppControlApps` (ex: "BitTorrent", "TeamViewer", "Proxy")
- **Anomalias** → top 2-3 de `metrics.topAnomalyTypes` (ex: "DoS", "Port Scan", "Spoofing")

## Alteração

**Arquivo:** `src/components/firewall/AnalyzerCategoryGrid.tsx`

1. Adicionar campo `topLabels?: string[]` ao `CategoryStats`
2. Em `getCategoryStats`, para `web_filter`, `app_control` e `anomalies`, popular `topLabels` com os nomes dos top 3 itens das respectivas listas de métricas
3. Na seção de badges (linhas 263-275), quando `topLabels` existir, renderizar badges com esses nomes em vez da severidade
4. Manter a barra de severidade colorida como está (só as badges mudam)
5. Estilo das badges: neutro (usando a cor da categoria como accent)

