

# Regra Arquitetural: Toda Coleta no Banco de Dados

## Regra Fundamental

**"Qualquer tipo de coleta de dados DEVE estar configurado em um template (device_type) e armazenado no banco de dados. Nenhuma logica de coleta pode existir hardcoded em Edge Functions ou codigo."**

---

## Estado Atual (Violacoes)

### 1. Microsoft 365 (`m365-security-posture`)
- **2.081 linhas** de codigo com 57+ verificacoes hardcoded
- Endpoints da Graph API embutidos diretamente nas funcoes
- Logica de avaliacao dispersa em funcoes como `collectIdentityInsights()`, `collectAuthInsights()`, etc.
- **Nenhum blueprint** existe para M365

### 2. Dominio Externo (`subdomain-enum`)  
- **813 linhas** com 9 APIs de enumeracao hardcoded (crt.sh, HackerTarget, AlienVault, etc.)
- Endpoints e logica de consulta embutidos
- Blueprint existe para DNS (7 steps via Agent), mas coleta de subdomains via Edge Function esta fora

### 3. Mapeamento `sourceKeyToEndpoint`
- **Linha 357-422** do `agent-task-result` contem mapeamento hardcoded de source_key para endpoints
- Deveria vir do banco de dados

---

## Arquitetura Proposta

### Novo Campo na Tabela `device_blueprints`

Adicionar suporte para dois tipos de executor:

| Campo | Valor | Descricao |
|-------|-------|-----------|
| `executor` | `agent` | Steps executados pelo Python Agent (atual) |
| `executor` | `edge_function` | Steps executados por Edge Function |

### Estrutura do `collection_steps` Unificada

```json
{
  "steps": [
    {
      "id": "users_count",
      "executor": "edge_function",
      "runtime": "graph_api",
      "config": {
        "endpoint": "/users/$count",
        "method": "GET",
        "headers": { "ConsistencyLevel": "eventual" },
        "api_version": "v1.0"
      }
    },
    {
      "id": "mfa_status",
      "executor": "edge_function", 
      "runtime": "graph_api",
      "config": {
        "endpoint": "/reports/authenticationMethods/userRegistrationDetails",
        "method": "GET",
        "params": { "$top": "999" },
        "api_version": "v1.0"
      }
    },
    {
      "id": "exchange_transport_rules",
      "executor": "agent",
      "runtime": "powershell",
      "config": {
        "module": "ExchangeOnlineManagement",
        "command": "Get-TransportRule",
        "auth": "certificate"
      }
    }
  ]
}
```

### Fluxo de Execucao

```text
+------------------+     +-------------------+     +------------------+
|   Trigger        |     |   Orchestrator    |     |   Executores     |
|   Analysis       | --> |   Edge Function   | --> |                  |
+------------------+     +-------------------+     +------------------+
                                |                         |
                                v                         v
                         Le blueprint do BD        +------+------+
                                |                  |             |
                                v                  v             v
                         Para cada step:     Agent Steps   Edge Steps
                                |            (Python)      (Deno)
                                |                |             |
                                v                v             v
                         Agrupa por tipo    http_request   graph_api
                                             ssh_command    rest_api
                                             powershell     dns_lookup
```

---

## Plano de Implementacao

### Fase 1: Infraestrutura (Banco de Dados)

| Arquivo | Acao |
|---------|------|
| Migration SQL | Adicionar campo `executor_type` em `device_blueprints` (enum: 'agent', 'edge_function', 'hybrid') |
| Migration SQL | Adicionar tabela `blueprint_step_templates` para reutilizacao de configuracoes comuns |

### Fase 2: Migrar M365 para Banco

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar blueprint "M365 - Postura de Seguranca" com 57+ steps |
| Migration SQL | Popular `collection_steps` com todos os endpoints da Graph API |
| Edge Function | Refatorar `m365-security-posture` para ler steps do banco e executar dinamicamente |

### Fase 3: Migrar Subdomain Enum

| Arquivo | Acao |
|---------|------|
| Migration SQL | Adicionar steps de `edge_function` ao blueprint External Domain |
| Edge Function | Refatorar `subdomain-enum` para ser um executor generico |

### Fase 4: Unificar Avaliacao

| Arquivo | Acao |
|---------|------|
| Edge Function | Criar `evaluate-compliance` generico que le regras do banco |
| Remover | Eliminar mapeamento `sourceKeyToEndpoint` hardcoded |

---

## Beneficios

1. **Administracao via UI**: Adicionar/editar verificacoes M365 sem deploy de codigo
2. **Consistencia**: Mesmo fluxo para todos os templates (Firewall, M365, Dominio)
3. **Auditoria**: Historico de mudancas nas regras de coleta
4. **Flexibilidade**: Suporte a coletas hibridas (Agent + Edge Function)
5. **Testabilidade**: Preview de verificacoes antes de ativar

---

## Estimativa

| Fase | Complexidade | Impacto |
|------|--------------|---------|
| Fase 1 | Baixa | Estrutura base |
| Fase 2 | Alta | M365 funcional via banco |
| Fase 3 | Media | Dominio Externo completo |
| Fase 4 | Media | Unificacao final |

---

## Status de Implementação

### ✅ Fase 1: Infraestrutura (CONCLUÍDO)
- [x] Enum `blueprint_executor_type` criado: `agent`, `edge_function`, `hybrid`
- [x] Coluna `executor_type` adicionada em `device_blueprints`
- [x] Tabela `blueprint_step_templates` criada para templates reutilizáveis

### ✅ Fase 2: M365 para Banco (CONCLUÍDO)
- [x] Blueprint "M365 - Postura de Segurança" criado com 39 steps Graph API
- [x] 59 regras de compliance já existentes no banco (IDT, ADM, AUT, APP, EXO, THR, INT, PIM, SPO, TMS, DEF)
- [x] 11 categorias de regras criadas
- [x] Edge Function `m365-security-posture` refatorada para ler steps do banco

### ✅ Fase 3: Migrar Subdomain Enum (CONCLUÍDO)
- [x] Blueprint External Domain atualizado para `hybrid` com 18 steps totais
- [x] 7 steps `agent` (DNS queries via Python Agent)
- [x] 11 steps `edge_function` (APIs de enumeração de subdomínios)
- [x] Phase 1: APIs premium (SecurityTrails, VirusTotal) executadas sequencialmente
- [x] Phase 2: APIs gratuitas (crt.sh, HackerTarget, etc.) executadas em paralelo
- [x] Edge Function `subdomain-enum` refatorada para ler steps do banco
- [x] Response parsers unificados em estrutura data-driven

### ✅ Fase 4: Unificar Avaliação (CONCLUÍDO)
- [x] Tabela `source_key_endpoints` criada para mapeamento dinâmico
- [x] Mapeamentos de FortiGate, SonicWall e External Domain populados
- [x] Função `loadSourceKeyEndpoints` criada para carregar do banco com cache
- [x] `processComplianceRules` refatorado para receber mapeamentos como parâmetro
- [x] Eliminado o objeto `sourceKeyToEndpoint` hardcoded (66 linhas removidas)
- [x] RLS policies aplicadas na nova tabela

