# Super Agent: Scan Ativo Automatizado de Superficie de Ataque

## Visao Geral

Criar uma camada de **Super Agents** — agentes de sistema (nao vinculados a workspaces) — que executam scans ativos diarios usando `masscan`, `nmap` e `httpx`. Os resultados sao exibidos automaticamente na pagina do Attack Surface Analyzer sem necessidade de intervencao do usuario.

## Arquitetura

### Fluxo de Execucao

```text
00:00 UTC
   |
   v
[CRON pg_cron] --> [Edge Function: run-attack-surface-queue]
   |
   v
Busca todos os workspaces ativos
   |
   v
Para cada workspace:
   Coleta IPs publicos (DNS + Firewall analyses)
   Cria 1 registro em attack_surface_snapshots (status=pending)
   Cria N agent_tasks (1 por IP) com target_type='attack_surface'
   |
   v
[Super Agent(s)] fazem polling normal via heartbeat
   |
   v
Para cada task:
   1. masscan (descoberta rapida de portas)
   2. nmap -sV (fingerprint de servicos nas portas encontradas)
   3. httpx (fingerprint web stack nas portas HTTP/HTTPS)
   |
   v
Resultado enviado via agent-step-result (progressivo)
   |
   v
[Edge Function: attack-surface-process] consolida resultados por snapshot
   |
   v
Snapshot atualizado: status=completed, score calculado
```

### Monitoramento de Carga

- O CRON roda as 00:00 UTC e gera a fila para o dia
- O sistema monitora: se as 23:00 ainda houver tasks pendentes, gera um alerta no `system_alerts`
- O alerta recomenda adicionar mais Super Agents para distribuir a carga
- Cada Super Agent puxa tasks da fila de forma autonoma (balanceamento natural)

## Mudancas no Banco de Dados

### 1. Tabela `agents` — Flag de Sistema

```sql
ALTER TABLE agents ADD COLUMN is_system_agent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agents ALTER COLUMN client_id DROP NOT NULL;
```

O campo `client_id` passa a ser nullable. Super Agents tem `client_id = NULL` e `is_system_agent = true`.

### 2. Tabela `system_alerts` (nova)

```sql
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,        -- 'super_agent_overload', 'scan_timeout', etc.
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

### 3. Tabela `attack_surface_tasks` (nova, fila granular)

```sql
CREATE TABLE attack_surface_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES attack_surface_snapshots(id),
  ip TEXT NOT NULL,
  source TEXT NOT NULL,             -- 'dns' ou 'firewall'
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, assigned, running, completed, failed
  assigned_agent_id UUID REFERENCES agents(id),
  result JSONB,                     -- ports, services, vulns, os, etc.
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Essa tabela substitui o uso de `agent_tasks` para o scan de superficie, dando mais controle granular sobre a fila IP por IP.

### 4. Atualizar RPC `rpc_get_agent_tasks`

Adicionar um novo bloco UNION ALL para Super Agents que busca tasks da tabela `attack_surface_tasks` em vez de `agent_tasks`, priorizando por status `pending` e distribuindo automaticamente:

```sql
-- Dentro de rpc_get_agent_tasks, novo bloco:
-- Super Agent: pegar tasks de attack_surface_tasks
SELECT ...
FROM attack_surface_tasks ast
JOIN attack_surface_snapshots snap ON snap.id = ast.snapshot_id
WHERE ast.status = 'pending'
  AND EXISTS (SELECT 1 FROM agents a WHERE a.id = p_agent_id AND a.is_system_agent = true)
ORDER BY ast.created_at ASC
LIMIT p_limit
```

Ao retornar, marca as tasks como `assigned` com o `assigned_agent_id`.

## Novos Executores Python (Agent)

### masscan executor (`python-agent/agent/executors/masscan.py`)

```text
Entrada: { ip, port_range (default "1-65535"), rate (default 10000) }
Comando: masscan {ip} -p{port_range} --rate={rate} -oJ -
Saida: { ports: [22, 80, 443, ...] }
```

### nmap executor (`python-agent/agent/executors/nmap.py`)

```text
Entrada: { ip, ports: [22, 80, 443] }
Comando: nmap -sV -sC -p{ports} {ip} -oX -
Saida: { services: [{port, protocol, product, version, cpe, scripts}] }
```

### httpx executor (`python-agent/agent/executors/httpx.py`)

```text
Entrada: { ip, ports: [80, 443, 8080] }
Comando: echo "{ip}" | httpx -ports {ports} -tech-detect -status-code -title -json
Saida: { web_services: [{url, status, title, technologies, server, tls}] }
```

### Instalacao de dependencias (`check-deps.sh`)

Adicionar verificacao e instalacao de `masscan`, `nmap` e `httpx` quando o agent for do tipo sistema:

```text
if is_system_agent:
  apt install -y masscan nmap
  install httpx from projectdiscovery releases
```

## Novas Edge Functions

### 1. `run-attack-surface-queue` (CRON diario)

- Busca todos os `clients` ativos
- Para cada client, extrai IPs publicos (mesma logica atual: DNS analyses + Firewall interfaces)
- Cria snapshot em `attack_surface_snapshots` com `status=pending`
- Insere 1 registro por IP em `attack_surface_tasks` com `status=pending`
- Se nenhum Super Agent estiver online, cria alerta

### 2. `attack-surface-step-result` (recebe resultados do agent)

- Recebe resultado de cada IP (masscan + nmap + httpx combinados)
- Atualiza `attack_surface_tasks` com o resultado
- Quando todos os IPs de um snapshot estiverem completos:
  - Consolida resultados
  - Calcula score de exposicao
  - Atualiza snapshot para `status=completed`

### 3. `check-attack-surface-progress` (CRON as 23:00)

- Verifica se existem snapshots com status `pending` ou `running` criados hoje
- Se sim, calcula percentual de conclusao
- Se < 80% concluido, cria alerta em `system_alerts`

## Mudancas na UI

### Pagina do Attack Surface Analyzer (refatoracao)

- **Remover** botao "Executar Scan" manual (scan e automatico agora)
- **Adicionar** indicador de "Ultimo scan" com timestamp e status
- **Adicionar** barra de progresso quando scan esta em andamento (X de Y IPs processados)
- **Melhorar layout** com secoes visuais mais ricas:
  - Mapa de portas por IP (heatmap visual)
  - Stack tecnologico detectado (httpx results)
  - Timeline de scans anteriores

### Pagina de Agents

- Adicionar uma pagina de gerenciamento desses Super Agents em Administração > Super Agent (espelhar a pagina Agent).
- Nao aparecem vinculados a nenhum workspace
- Mostrar metricas: tasks processadas hoje, fila restante

### Alertas de Sistema

- Banner no topo da aplicacao quando houver alertas nao reconhecidos
- Apenas visivel para super_admin

## Blueprint do Super Agent

O blueprint para scan de superficie sera registrado na tabela `device_blueprints` com `device_type_id` referenciando um novo tipo `attack_surface`:

```text
device_types:
  code: 'attack_surface'
  name: 'Attack Surface Scanner'
  vendor: 'iScope'
  category: 'scanner'

device_blueprints:
  steps:
    1. masscan (descoberta de portas)
    2. nmap -sV (fingerprint nos ports encontrados)
    3. httpx (fingerprint web)
```

## CRON Setup (pg_cron)

```sql
-- Scan diario as 00:00 UTC
SELECT cron.schedule('attack-surface-daily', '0 0 * * *', $$
  SELECT net.http_post(
    url:='https://akbosdbyheezghieiefz.supabase.co/functions/v1/run-attack-surface-queue',
    headers:='{"Authorization": "Bearer <service_role_key>"}'::jsonb,
    body:='{}'::jsonb
  );
$$);

-- Verificacao de progresso as 23:00 UTC
SELECT cron.schedule('attack-surface-check', '0 23 * * *', $$
  SELECT net.http_post(
    url:='https://akbosdbyheezghieiefz.supabase.co/functions/v1/check-attack-surface-progress',
    headers:='{"Authorization": "Bearer <service_role_key>"}'::jsonb,
    body:='{}'::jsonb
  );
$$);
```

## Fases de Implementacao

### Fase 1: Infraestrutura (banco + agent)

- Migracoes de banco (is_system_agent, attack_surface_tasks, system_alerts)
- Novos executores Python (masscan, nmap, httpx)
- Atualizacao do check-deps.sh
- Logica no RPC para Super Agents pegarem tasks da fila

### Fase 2: Edge Functions (orquestracao)

- run-attack-surface-queue (CRON)
- attack-surface-step-result (recebe resultados)
- check-attack-surface-progress (CRON de monitoramento)

### Fase 3: UI (apresentacao)

- Refatorar AttackSurfaceAnalyzerPage com novo layout
- Secao de Super Agents na pagina de Agents
- Sistema de alertas no topo da aplicacao

## Arquivos a criar/editar

**Novos arquivos:**

- `python-agent/agent/executors/masscan.py`
- `python-agent/agent/executors/nmap.py`
- `python-agent/agent/executors/httpx.py`
- `supabase/functions/run-attack-surface-queue/index.ts`
- `supabase/functions/attack-surface-step-result/index.ts`
- `supabase/functions/check-attack-surface-progress/index.ts`

**Arquivos a editar:**

- `python-agent/agent/tasks.py` — registrar novos executores
- `python-agent/check-deps.sh` — instalar masscan, nmap, httpx
- `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` — redesign completo
- `src/pages/AgentsPage.tsx` — secao de Super Agents
- `src/hooks/useAttackSurfaceData.ts` — adaptar para nova estrutura
- `src/components/alerts/SystemAlertBanner.tsx` — alertas de Super Agent

**Migracoes SQL:**

- ALTER agents (is_system_agent, client_id nullable)
- CREATE attack_surface_tasks
- CREATE system_alerts
- INSERT device_types (attack_surface)
- INSERT device_blueprints (scan ativo)
- UPDATE rpc_get_agent_tasks
- CRON jobs (pg_cron)