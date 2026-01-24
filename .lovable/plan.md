
# Plano: Integração Completa do SonicWall TZ 370

## Visão Geral

Este plano adiciona suporte completo ao SonicWall TZ 370 (e outros modelos SonicOS 7.x) ao iScope360, mantendo a arquitetura "agente genérico" existente. A principal diferença do FortiGate é que o SonicWall usa **autenticação baseada em sessão** (login/logout) em vez de API Key estática.

---

## Dados Confirmados da API SonicWall

| Endpoint | Dados Disponíveis |
|----------|-------------------|
| `POST /api/sonicos/auth` | Login (retorna sessão via cookie) |
| `DELETE /api/sonicos/auth` | Logout (libera sessão) |
| `GET /api/sonicos/version` | Firmware, modelo, serial, uptime (texto) |
| `GET /api/sonicos/interfaces/ipv4` | 9 interfaces com configurações de segurança |
| `GET /api/sonicos/access-rules/ipv4` | 30+ regras com DPI, GeoIP, Botnet filter |

---

## Arquitetura da Solução

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE COLETA SONICWALL                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Platform envia tarefa com steps do blueprint                             │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │ steps: [                                                            │  │
│     │   { id: "auth_login", executor: "http_session", config: {...} }     │  │
│     │   { id: "version", executor: "http_session", config: {...} }        │  │
│     │   { id: "interfaces", executor: "http_session", config: {...} }     │  │
│     │   { id: "access_rules", executor: "http_session", config: {...} }   │  │
│     │   { id: "auth_logout", executor: "http_session", config: {...} }    │  │
│     │ ]                                                                   │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  2. Python Agent executa steps usando HTTPSessionExecutor                    │
│     - Primeiro step (auth_login) faz Basic Auth e armazena cookies           │
│     - Steps seguintes usam os cookies da sessão                              │
│     - Último step (auth_logout) encerra a sessão                             │
│                                                                              │
│  3. Resultados enviados para agent-task-result                               │
│     - Backend processa dados usando compliance_rules do SonicWall            │
│     - Calcula score e salva no analysis_history                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Necessárias

### 1. Novo Executor: HTTPSessionExecutor

**Arquivo:** `python-agent/agent/executors/http_session.py` (NOVO)

Este executor gerencia sessões HTTP com cookies persistentes entre steps.

**Funcionalidades:**
- Usa `requests.Session()` para manter cookies entre requests
- Suporta Basic Auth para login inicial
- Step especial `auth_login` armazena sessão no contexto
- Step especial `auth_logout` encerra a sessão
- Steps intermediários usam a sessão automaticamente

```python
# Exemplo de estrutura
class HTTPSessionExecutor(BaseExecutor):
    """Executor para APIs que usam sessão (cookies)."""
    
    def __init__(self, logger):
        super().__init__(logger)
        self._session = None  # requests.Session()
    
    def run(self, step, context):
        config = step.get('config', {})
        action = config.get('action')  # 'login', 'request', 'logout'
        
        if action == 'login':
            return self._do_login(config, context)
        elif action == 'logout':
            return self._do_logout(config, context)
        else:
            return self._do_request(config, context)
```

### 2. Atualizar TaskExecutor para Passar Sessão Entre Steps

**Arquivo:** `python-agent/agent/tasks.py`

Modificar para que o contexto seja atualizado entre steps, permitindo que a sessão do login seja usada pelos steps seguintes.

```python
# No método execute():
for i, step in enumerate(steps):
    result = executor.run(step, context)
    
    # Se o executor retornou sessão, atualizar contexto
    if result.get('session_data'):
        context.update(result['session_data'])
```

### 3. Registrar Novo Executor

**Arquivo:** `python-agent/agent/tasks.py`

```python
from agent.executors.http_session import HTTPSessionExecutor

self._executors = {
    'http_request': HTTPRequestExecutor(logger),
    'http_session': HTTPSessionExecutor(logger),  # NOVO
    'ssh_command': SSHExecutor(logger),
    'snmp_query': SNMPExecutor(logger),
}
```

### 4. Novo Device Type: SonicWall

**Tabela:** `device_types`

| Campo | Valor |
|-------|-------|
| name | SonicWall TZ |
| vendor | SonicWall |
| code | sonicwall_tz |
| category | firewall |
| icon | Shield |
| is_active | true |

### 5. Blueprint de Coleta SonicWall

**Tabela:** `device_blueprints`

```json
{
  "steps": [
    {
      "id": "auth_login",
      "executor": "http_session",
      "config": {
        "action": "login",
        "method": "POST",
        "path": "/api/sonicos/auth",
        "headers": {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        "basic_auth": true
      }
    },
    {
      "id": "version",
      "executor": "http_session",
      "config": {
        "action": "request",
        "method": "GET",
        "path": "/api/sonicos/version",
        "headers": {
          "Accept": "application/json"
        }
      }
    },
    {
      "id": "interfaces",
      "executor": "http_session",
      "config": {
        "action": "request",
        "method": "GET",
        "path": "/api/sonicos/interfaces/ipv4",
        "headers": {
          "Accept": "application/json"
        }
      }
    },
    {
      "id": "access_rules",
      "executor": "http_session",
      "config": {
        "action": "request",
        "method": "GET",
        "path": "/api/sonicos/access-rules/ipv4",
        "headers": {
          "Accept": "application/json"
        }
      }
    },
    {
      "id": "auth_logout",
      "executor": "http_session",
      "config": {
        "action": "logout",
        "method": "DELETE",
        "path": "/api/sonicos/auth"
      }
    }
  ]
}
```

### 6. Atualizar Tabela firewalls

A tabela `firewalls` atualmente tem `api_key` para FortiGate. Para SonicWall, precisamos de `username` e `password`.

**Opção A (Recomendada):** Adicionar campos opcionais
```sql
ALTER TABLE firewalls 
ADD COLUMN auth_username TEXT,
ADD COLUMN auth_password TEXT;
-- api_key continua existindo para FortiGate
```

**Opção B:** Usar api_key como JSON
```
-- api_key = '{"username": "admin", "password": "xxx"}'
-- Menos elegante, mas sem alteração de schema
```

### 7. Atualizar Edge Function agent-tasks

**Arquivo:** `supabase/functions/agent-tasks/index.ts`

Modificar `getTargetCredentials` para incluir username/password quando disponíveis:

```typescript
if (targetType === 'firewall') {
  const { data: firewall } = await supabase
    .from('firewalls')
    .select('id, name, fortigate_url, api_key, auth_username, auth_password, device_type_id')
    .eq('id', targetId)
    .single();

  return {
    id: firewall.id,
    type: 'firewall',
    base_url: firewall.fortigate_url,
    credentials: {
      api_key: firewall.api_key,
      username: firewall.auth_username,  // Para SonicWall
      password: firewall.auth_password,  // Para SonicWall
    },
  };
}
```

### 8. Atualizar Edge Function agent-task-result

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Adicionar lógica para processar dados do SonicWall:

```typescript
// Detectar tipo de dispositivo e processar adequadamente
const deviceType = await getDeviceType(supabase, firewallId);

if (deviceType.code === 'sonicwall_tz') {
  // Parse uptime do formato texto "10 Days, 5 Hours, 58 Minutes, 33 Seconds"
  const versionData = rawData['version'] as Record<string, unknown>;
  if (versionData?.system_uptime) {
    systemInfo.uptime = parseUptimeString(versionData.system_uptime);
  }
  if (versionData?.firmware_version) {
    systemInfo.firmware = versionData.firmware_version;
  }
  if (versionData?.serial_number) {
    systemInfo.serial = versionData.serial_number;
  }
}
```

### 9. Regras de Compliance para SonicWall

**Tabela:** `compliance_rules`

Exemplos de regras baseadas nos dados coletados:

| Código | Nome | Lógica |
|--------|------|--------|
| SW-MGMT-01 | HTTPS na WAN | Verificar se interfaces WAN têm management.https = false |
| SW-MGMT-02 | SSH Desabilitado | Verificar se interfaces têm ssh = false |
| SW-DPI-01 | DPI Ativo | Verificar se regras de firewall têm dpi = true |
| SW-BOTNET-01 | Filtro Botnet | Verificar se regras críticas têm botnet_filter = true |
| SW-GEOIP-01 | Filtro GeoIP | Verificar se regras WAN têm geo_ip_filter.enable = true |
| SW-LOG-01 | Logging Ativo | Verificar se regras têm logging = true |

### 10. Atualizar Forms do Frontend

**Arquivos:**
- `src/components/firewall/AddFirewallDialog.tsx`
- `src/components/firewall/EditFirewallDialog.tsx`

Alterações:
1. Mostrar campos diferentes baseado no device_type selecionado
2. FortiGate: Mostrar campo "API Key"
3. SonicWall: Mostrar campos "Usuário" e "Senha"
4. Renomear label "URL do FortiGate" para "URL do Dispositivo"

---

## Sequência de Implementação

| Fase | Arquivos | Descrição |
|------|----------|-----------|
| **1** | Migração SQL | Adicionar colunas auth_username, auth_password à tabela firewalls |
| **2** | Device Type + Blueprint | Inserir SonicWall no banco via Admin UI ou migração |
| **3** | HTTPSessionExecutor | Criar novo executor Python para sessões |
| **4** | tasks.py | Registrar executor e passar sessão entre steps |
| **5** | agent-tasks | Incluir username/password nas credenciais |
| **6** | agent-task-result | Processar dados SonicWall (uptime, firmware) |
| **7** | Frontend Forms | Campos dinâmicos por device_type |
| **8** | Compliance Rules | Inserir regras via Admin UI |

---

## Estimativa de Esforço

| Componente | Complexidade | Tempo Estimado |
|------------|--------------|----------------|
| HTTPSessionExecutor | Média | ~1h |
| Migração + Device Type | Baixa | ~15min |
| Edge Functions | Média | ~1h |
| Frontend Forms | Média | ~45min |
| Compliance Rules | Baixa | ~30min |
| **Total** | | **~3.5h** |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Limite de sessões no SonicWall | Sempre executar logout no final |
| Timeout de sessão | Timeout configurável no blueprint |
| Diferentes versões de SonicOS | Testar com firmware 7.x+ |

---

## Próximo Passo

Deseja que eu comece a implementação? Sugiro começar pela:
1. **Migração de banco** (adicionar colunas)
2. **HTTPSessionExecutor** (código Python)
3. **Blueprint + Device Type** (dados)

Assim você já pode testar a coleta básica antes de implementar o restante.
