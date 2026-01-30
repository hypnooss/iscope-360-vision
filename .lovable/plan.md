
Objetivo
- Tirar o blueprint de “Domínios Externos” do hardcode (dentro da RPC `rpc_get_agent_tasks`) e passar a usar o mesmo mecanismo de blueprints de Firewalls: `device_types` + `device_blueprints`.
- Garantir que esse blueprint apareça em **Administração > Coletas > Domínios Externos** (rota `/collections`, aba “Domínios Externos”).

Diagnóstico (como está hoje)
- Hoje o blueprint de Domínios Externos está hardcoded dentro da função SQL `public.rpc_get_agent_tasks` (ver migration `supabase/migrations/20260130025010_...sql`, bloco “External domain tasks (DNS multi-step)”).
- Já existe um sistema de blueprints no banco:
  - `device_types` (categoria)
  - `device_blueprints` (collection_steps JSONB)
- A UI de **Administração > Coletas** já lista device types e blueprints por categoria:
  - A aba “Domínios Externos” mapeia para `device_types.category = 'other'`.
  - Os blueprints são lidos de `device_blueprints` pelo `device_type_id` (via `DeviceTypeCard`/`BlueprintsManagement`).

Decisão técnica (para ficar igual a Firewalls)
1) Criar um `device_type` “Domínio Externo” no banco (categoria `other`, code `external_domain`).
2) Criar um `device_blueprint` ativo para esse `device_type`, contendo os steps DNS (NS/MX/SOA/SPF/DMARC/DKIM/DNSSEC).
3) Alterar a RPC `rpc_get_agent_tasks` para:
   - no branch de `target_type = 'external_domain'`, buscar o blueprint em `device_blueprints` pelo `device_type` `code = 'external_domain'` (igual ao que já é feito para firewall via `f.device_type_id` e fallback `fortigate`).
4) Ajustar o python-agent/executor `dns_query` para não depender de `config.domain` fixo (porque um blueprint “global” não pode vir com o domínio hardcoded):
   - se `config.domain` estiver vazio, derivar do `context.base_url` (já vem do `target.base_url`), extraindo o hostname.

Por que essa abordagem resolve exatamente o que você pediu
- Blueprint deixa de estar hardcoded e passa a ser gerenciado no banco (CRUD via UI admin, ou SQL).
- O blueprint passa a aparecer automaticamente em **Administração > Coletas > Domínios Externos**, porque a UI já lista tudo que estiver em `device_types.category='other'` e seus `device_blueprints`.

Escopo de implementação (o que vou mudar)

A) Banco de dados (schema vs dados)
Importante: no seu projeto, as regras dizem:
- Alterações de “estrutura” (ex.: criar/alterar função SQL) via migration.
- Inserções/updates de dados (ex.: criar `device_type` e `device_blueprint`) via ferramenta de “insert”/“data operation”, não migration.

A1) Migration (schema): atualizar `rpc_get_agent_tasks`
- Remover o JSON hardcoded do blueprint de external_domain dentro da função e trocar por:
  - `SELECT db.collection_steps FROM device_blueprints db WHERE db.device_type_id = (SELECT id FROM device_types WHERE code='external_domain' AND is_active=true LIMIT 1) AND db.is_active=true ORDER BY db.version DESC LIMIT 1`
  - Fallback: `{"steps": []}` se não houver blueprint cadastrado.
- Mantém o resto da RPC igual (JOIN com `external_domains` para montar `target.base_url` etc).

A2) Data operations (dados): criar `device_type` e `device_blueprint`
- Inserir `device_types` (se não existir) com:
  - vendor: “iScope” (ou “Precísio Analytics” se preferir, mas vou seguir iScope como padrão)
  - name: “Domínio Externo”
  - code: `external_domain` (confirmado por você)
  - category: `other`
  - icon: `Globe`
  - is_active: true
- Inserir `device_blueprints` (se não existir um ativo) para esse device_type:
  - name: “External Domain DNS Scan”
  - version: “any”
  - is_active: true
  - collection_steps: JSON com steps:
    - ns_records (dns_query, query_type NS)
    - mx_records (dns_query, query_type MX)
    - soa_record (dns_query, query_type SOA)
    - spf_record (dns_query, query_type SPF)
    - dmarc_record (dns_query, query_type DMARC)
    - dkim_records (dns_query, query_type DKIM, selectors = sua lista)
    - dnssec_status (dns_query, query_type DNSSEC, best_effort true)
  - Observação: nesse blueprint armazenado no banco, eu NÃO vou salvar o campo `domain` dentro do config (porque ele varia por tarefa). Isso será resolvido no agent (item B).

B) Python-agent: deixar blueprint “genérico” funcionar
B1) Ajustar `DNSQueryExecutor` (`python-agent/agent/executors/dns_query.py`)
- Se `step.config.domain` estiver ausente:
  - pegar `context['base_url']`
  - extrair hostname (ex.: `https://example.com` -> `example.com`)
  - usar isso como domínio base.
- Isso faz o blueprint ser 100% gerenciável no banco e reaproveitável para qualquer domínio.

C) UI (Administração > Coletas)
- A princípio não precisa mudar nada na UI:
  - `/collections` já busca `device_types` por categoria (external -> `other`) e carrega `device_blueprints` por `device_type_id`.
- Critério: assim que o `device_type` e o `device_blueprint` existirem, o card vai aparecer e a blueprint vai ser exibida/gerenciável ali.
- Se por algum motivo vocês quiserem uma tela “BlueprintsManagement” dedicada nessa aba (além do `DeviceTypeCard`), aí sim eu adiciono, mas hoje já existe gestão dentro de `DeviceTypeCard`.

Plano de validação (aceite)
1) Banco
- Confirmar que existe `device_types` com `code = external_domain` e `category = other`.
- Confirmar que existe `device_blueprints` ativo para esse device_type com os steps DNS.

2) UI Admin
- Ir em **Administração > Coletas > Domínios Externos**
- Ver o “tipo de dispositivo” Domínio Externo listado.
- Ver a blueprint “External Domain DNS Scan” listada no card, com o JSON dos steps.

3) Fluxo do agent
- Disparar “Analisar” para um domínio externo
- Confirmar que:
  - o agent recebe o blueprint vindo do banco (via RPC)
  - os steps executam mesmo sem `config.domain` (porque o executor deriva do `base_url`)
  - os resultados aparecem em Execuções.

Notas técnicas / detalhes de implementação
- A RPC atual monta `target.base_url` como `https://{d.domain}`; isso já é suficiente para o agent derivar o domínio.
- O padrão de seleção de blueprint por `device_types.code` é coerente com o fallback que já existe para FortiGate (`device_types.code = 'fortigate'`).

Entregáveis (arquivos/touchpoints)
- Supabase:
  - Migration: atualizar `rpc_get_agent_tasks` (schema).
  - Data operations: inserir `device_types` + `device_blueprints` para `external_domain`.
- Python-agent:
  - Editar `python-agent/agent/executors/dns_query.py` (fallback domain via base_url).
- Frontend:
  - Sem mudanças obrigatórias, apenas validação em `/collections`.

Riscos / edge cases
- Se já existir algum `device_type` `external_domain` criado manualmente, a inserção deve ser idempotente (verificar por `code` antes de inserir).
- Se o `base_url` vier vazio por algum motivo, o executor deve falhar de forma “segura” com mensagem clara (ex.: “domain não informado e base_url ausente”).
