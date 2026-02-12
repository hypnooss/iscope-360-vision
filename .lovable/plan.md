

# Corrigir o botao "Disparar Scan" para usar o modelo baseado em Agent

## Problema
O botao "Disparar Scan" invoca a edge function `attack-surface-scan`, que faz todo o enriquecimento server-side usando APIs (Shodan, Censys, InternetDB). O Super Agent com masscan/nmap/httpx nunca e acionado.

## Solucao
A edge function `run-attack-surface-queue` ja implementa o modelo correto: coleta IPs, cria um snapshot com status `pending`, e insere tasks individuais na tabela `attack_surface_tasks` para o Super Agent processar. Porem, ela processa **todos os clientes** de uma vez (projetada para cron/fila).

### Plano de alteracoes

**1. Criar endpoint para disparo manual de um unico cliente**

Modificar a edge function `run-attack-surface-queue` para aceitar um parametro opcional `client_id` no body. Quando fornecido, processar apenas aquele cliente. Quando nao fornecido, manter o comportamento atual (todos os clientes, para uso via cron).

Arquivo: `supabase/functions/run-attack-surface-queue/index.ts`
- Ler `client_id` do body da requisicao (se POST com body)
- Se `client_id` fornecido: processar apenas esse cliente
- Se nao: manter logica existente (buscar todos os clientes)

**2. Alterar o hook `useAttackSurfaceScan` para chamar a funcao correta**

Arquivo: `src/hooks/useAttackSurfaceData.ts`
- Mudar de `attack-surface-scan` para `run-attack-surface-queue`
- O body ja envia `{ client_id }`, compativel com a mudanca

### Secao tecnica

A mudanca na edge function e minima (~10 linhas). O trecho principal:

```text
// No inicio do handler, apos criar o supabase client:
const body = await req.json().catch(() => ({}))
const targetClientId = body.client_id

// Substituir a query de clients:
let clientsList
if (targetClientId) {
  // Disparo manual: cliente especifico
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', targetClientId)
    .single()
  if (error) throw error
  clientsList = [data]
} else {
  // Fila automatica: todos os clientes
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
  if (error) throw error
  clientsList = data || []
}
```

No hook do frontend, a unica mudanca e o nome da funcao invocada:

```text
// De:
supabase.functions.invoke('attack-surface-scan', ...)
// Para:
supabase.functions.invoke('run-attack-surface-queue', ...)
```

### Fluxo esperado apos a correcao

```text
Botao "Disparar Scan"
  -> run-attack-surface-queue (client_id=X)
    -> Coleta IPs (DNS + Firewall)
    -> Cria snapshot (status=pending)
    -> Cria 1 task por IP (status=pending)
    -> Super Agent busca tasks via heartbeat
      -> Executa masscan (port discovery)
      -> Executa nmap (service detection)
      -> Executa httpx (web tech detection)
      -> Envia resultado via attack-surface-step-result
    -> Snapshot consolidado quando todas as tasks completam
```

### Arquivos alterados
- `supabase/functions/run-attack-surface-queue/index.ts` (aceitar client_id opcional)
- `src/hooks/useAttackSurfaceData.ts` (trocar funcao invocada)
- Deploy da edge function `run-attack-surface-queue`

