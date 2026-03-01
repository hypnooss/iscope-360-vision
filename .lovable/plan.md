

## Adicionar Command Central ao M365 Compliance

### Objetivo
Substituir o card de score atual (linhas 199-226 do `M365PosturePage.tsx`) por um Command Central visual identico ao do Firewall Compliance, com o mesmo estilo dark com grid pattern, titulo centralizado, gauge na esquerda com mini stats, e coluna de detalhes na direita.

### Alteracao

**Arquivo: `src/pages/m365/M365PosturePage.tsx`**

1. Importar os componentes `MiniStat` e `DetailRow` do `Dashboard.tsx` -- como sao componentes internos, extrair para um arquivo compartilhado ou replicar localmente no M365PosturePage

2. Substituir o bloco `Score Header` (Card glass-card, linhas 199-226) pelo layout Command Central:
   - Container `rounded-2xl border border-primary/20` com background gradient dark
   - Grid pattern overlay (mesmo do Firewall)
   - Titulo centralizado: nome do tenant selecionado (`selectedTenant?.name`)
   - Grid 2 colunas: ScoreGauge + MiniStats na esquerda, DetailRows na direita
   - MiniStats: Total, Aprovadas, Falhas (calculados a partir de `data?.summary`)
   - Coluna direita: placeholder com dados basicos do tenant (dominio, ultima coleta, status do agent) -- detalhes a alinhar depois

3. Extrair `MiniStat` e `DetailRow` de `Dashboard.tsx` para `src/components/CommandCentral.tsx` compartilhado, evitando duplicacao de codigo entre Firewall e M365

### Arquivos a editar
1. **`src/components/CommandCentral.tsx`** (novo) -- exportar `MiniStat`, `DetailRow` e o wrapper `CommandCentralLayout` reutilizavel
2. **`src/components/Dashboard.tsx`** -- importar de `CommandCentral.tsx` em vez de definir localmente
3. **`src/pages/m365/M365PosturePage.tsx`** -- substituir o Score Header pelo Command Central usando os componentes compartilhados

### Resultado
- Visual identico ao Firewall: dark card com grid, gauge, mini stats, detail rows
- Coluna direita com dados placeholder (tenant name, domain, agent status) para alinhar conteudo depois
- Componentes reutilizaveis para futuros modulos

