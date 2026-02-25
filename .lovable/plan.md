

# Terminal Remoto via Agents — Plano de Implementação

## Conceito

Criar um mecanismo de "Remote Shell" que permite ao super_admin enviar comandos ao servidor do agent pela GUI, sem precisar fazer SSH direto. O fluxo usa a infraestrutura existente de tarefas (agent_tasks + heartbeat polling) como canal de comunicação.

## Arquitetura

```text
GUI (super_admin)              Supabase                    Agent (Python)
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
│ Terminal UI       │    │                     │    │                      │
│ $ systemctl stop  │───▶│ agent_commands      │    │ heartbeat tick       │
│                   │    │   status: pending   │───▶│   → poll commands    │
│                   │    │                     │    │   → subprocess.run() │
│ stdout/stderr ◀───│────│   status: completed │◀───│   → POST result      │
│                   │    │   output: "..."     │    │                      │
└──────────────────┘    └─────────────────────┘    └──────────────────────┘
```

O agent NÃO abre um socket/porta. Ele simplesmente busca comandos pendentes durante o heartbeat e executa via `subprocess.run()` com timeout, retornando stdout/stderr.

## Segurança

- Somente `super_admin` pode criar comandos (RLS + frontend guard)
- Comandos executados como o usuário do processo (root no supervisor)
- Timeout de 60s por comando para evitar travamento
- Histórico de todos os comandos ficam logados na tabela
- Comandos são one-shot (não é uma sessão interativa persistente)

## Mudanças

### 1. Nova tabela: `agent_commands`

```sql
CREATE TABLE public.agent_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  command text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, timeout
  stdout text,
  stderr text,
  exit_code integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  timeout_seconds integer NOT NULL DEFAULT 60
);

ALTER TABLE public.agent_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage commands"
  ON public.agent_commands FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Service role can manage commands"
  ON public.agent_commands FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');
```

### 2. Edge Function: `agent-heartbeat/index.ts`

Na resposta do heartbeat, incluir flag `has_pending_commands: true` quando existirem comandos pendentes para o agent. O agent então faz GET em uma nova Edge Function para buscar os comandos.

### 3. Nova Edge Function: `agent-commands/index.ts`

Dois endpoints:
- **GET** (chamado pelo agent): Retorna comandos pendentes para o agent autenticado, marca como `running`
- **POST** (chamado pelo agent): Recebe resultado (stdout, stderr, exit_code), marca como `completed`

### 4. Python Agent: `python-agent/agent/remote_commands.py` (novo)

Módulo que:
1. Verifica no heartbeat response se `has_pending_commands == true`
2. Busca comandos via GET `/agent-commands`
3. Executa cada comando com `subprocess.run(command, shell=True, timeout=60, capture_output=True)`
4. Envia resultado via POST `/agent-commands`

### 5. Integração no Supervisor: `python-agent/supervisor/main.py`

No loop principal, após processar o heartbeat:
```python
if result.get("has_pending_commands"):
    _handle_remote_commands(logger, api, state)
```

### 6. Frontend: Componente `RemoteTerminal` no `AgentDetailPage.tsx`

Card na página de detalhe do agent com:
- Input de comando + botão "Executar"
- Lista de comandos recentes com status (pending → running → completed)
- Exibição de stdout/stderr em bloco `<pre>` estilo terminal
- Polling a cada 2s enquanto houver comandos pendentes
- Somente visível para super_admin

## Arquivos afetados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| Migração SQL | Novo | Tabela `agent_commands` |
| `supabase/functions/agent-commands/index.ts` | Novo | Edge Function GET/POST |
| `supabase/functions/agent-heartbeat/index.ts` | Edição | Adicionar `has_pending_commands` na resposta |
| `supabase/config.toml` | Edição | Registrar nova function |
| `python-agent/agent/remote_commands.py` | Novo | Executor de comandos remotos |
| `python-agent/supervisor/main.py` | Edição | Integrar checagem de comandos |
| `src/components/agents/RemoteTerminal.tsx` | Novo | Componente UI do terminal |
| `src/pages/AgentDetailPage.tsx` | Edição | Incluir RemoteTerminal |

## Fluxo completo

1. Admin digita `systemctl stop iscope-agent` na GUI
2. INSERT em `agent_commands` com status `pending`
3. Próximo heartbeat retorna `has_pending_commands: true`
4. Agent faz GET `/agent-commands` → recebe o comando
5. Agent executa `subprocess.run("systemctl stop iscope-agent", shell=True, timeout=60)`
6. Agent faz POST `/agent-commands` com stdout, stderr, exit_code
7. Frontend polling detecta `completed` e exibe o output

Latência esperada: entre 0 e `heartbeat_interval` segundos (default 120s) para o agent captar o comando. Para comandos urgentes, o heartbeat interval pode ser reduzido temporariamente.

