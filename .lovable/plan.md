

# Corrigir Contagem de Alteracoes de Configuracao e Persistir Historico

## Problema 1: Contagem inflada (11501 alteracoes)

A funcao `analyzeConfigChanges` no edge function `firewall-analyzer` filtra "alteracoes reais" usando keywords como `delete`, `set`, `add`, etc. (linha 574). O problema e que acoes automaticas de VPN como `delete_phase1_sa` (negociacoes IPsec) tambem casam com esses filtros, gerando `configChanges: 500` (limite de logs) por snapshot. Na agregacao de 24h (24 snapshots), isso soma ~11500.

Curiosamente, os `configChangeDetails` ficam vazios na maioria dos snapshots porque essas entradas automaticas possuem usuarios como IPs ou "unknown" que acabam passando pelo filtro, mas sem `cfgpath` util.

### Dados comprovando o problema:
- Firewall AR-BAC-FW-001: 20 de 24 snapshots com `configChanges: 500` e `configChangeDetails: []`
- Apenas 4 snapshots com `configChanges: 1` possuem detalhes reais (ex: edit de politica por usuario "selbetti.gabriel")
- Exemplo de log errado contado: `delete_phase1_sa` com user "192.168.1.35"

## Problema 2: Sem historico persistente

Atualmente as alteracoes de config sao armazenadas dentro do JSON `metrics.configChangeDetails` do snapshot (limitado a 200 registros). Quando o snapshot e reciclado ou agregado, os detalhes podem ser perdidos. Nao existe um historico consultavel.

## Solucao

### Parte 1: Corrigir filtragem no Edge Function

**Arquivo: `supabase/functions/firewall-analyzer/index.ts`**

Na funcao `analyzeConfigChanges` (a partir da linha 573):

- Adicionar exclusoes explicitas para acoes automaticas do sistema (IPsec SA, VPN tunnel events)
- Filtrar entradas onde o `user` e um IP ou "unknown" (nao sao alteracoes de administradores)
- Exigir presenca de `cfgpath` para considerar como alteracao real (sem cfgpath = evento de sistema, nao configuracao)
- Atualizar `configChanges` para refletir apenas o count filtrado

Padroes a excluir:
- `action` contendo: `phase1_sa`, `phase2_sa`, `tunnel-up`, `tunnel-down`, `tunnel-stats`
- `user` que e um IP (regex `/^\d+\.\d+\.\d+/`)
- `user` = "unknown" ou vazio
- Logs sem `cfgpath` (nao sao modificacoes de configuracao)

### Parte 2: Tabela para historico persistente

**Nova migration: criar tabela `analyzer_config_changes`**

```text
Colunas:
- id (uuid, PK)
- firewall_id (uuid, FK -> firewalls)
- client_id (uuid, FK -> clients)
- snapshot_id (uuid, FK -> analyzer_snapshots)
- user_name (text) - quem fez a alteracao
- action (text) - edit, add, delete
- cfgpath (text) - caminho da configuracao
- cfgobj (text) - objeto alterado
- cfgattr (text) - atributo alterado
- msg (text) - mensagem do log
- category (text) - categoria derivada
- severity (text) - severidade derivada
- changed_at (timestamptz) - data/hora da alteracao
- created_at (timestamptz, default now)

Indices: firewall_id, client_id, changed_at
RLS: habilitado com politicas de leitura para usuarios do workspace
```

### Parte 3: Edge Function grava no historico

**Arquivo: `supabase/functions/firewall-analyzer/index.ts`**

Apos processar `configChangeDetails`, inserir os registros na tabela `analyzer_config_changes` com deduplicacao por `firewall_id + user_name + action + cfgpath + cfgobj + changed_at` para evitar duplicatas entre coletas.

### Parte 4: Frontend le da tabela persistente

**Arquivo: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`**

- Substituir leitura de `snapshot.metrics.configChangeDetails` por query direta a tabela `analyzer_config_changes`
- Adicionar filtro de data (periodo) para consultar historico
- Remover filtro de sistema no frontend (ja filtrado no backend)
- Paginacao para grandes volumes de dados

**Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`**

- O card "Alteracoes Config" passara a mostrar o count filtrado corretamente (vindo do snapshot corrigido)

### Parte 5: Corrigir contagem no dashboard agregado

**Arquivo: `src/hooks/useAnalyzerData.ts`**

- O `configChanges` ja e somado pelo `aggregateSnapshots`. Com a correcao no edge function, o valor vai refletir apenas alteracoes reais.
- `configChangeDetails` no snapshot continua existindo para compatibilidade, mas a pagina de detalhes le da tabela dedicada.

## Resumo das alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| Nova migration | Schema | Criar tabela `analyzer_config_changes` |
| `supabase/functions/firewall-analyzer/index.ts` | Backend | Filtrar eventos de sistema, gravar historico na tabela |
| `src/pages/firewall/AnalyzerConfigChangesPage.tsx` | Frontend | Ler da tabela persistente, adicionar filtro de data |
| `src/integrations/supabase/types.ts` | Types | Adicionar tipos da nova tabela |

