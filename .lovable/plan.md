

# Plano: Corrigir Endpoints Finais da API SonicOS 7.x

## Problema Identificado

A API SonicOS 7.x está retornando erro `E_INVALID_API_CALL: "API endpoint is incomplete."` (HTTP 400) para a maioria dos endpoints de Security Services. Os dados brutos confirmam:

**Endpoints que funcionaram:**
- `/api/sonicos/version` - Retornou modelo, firmware, serial
- `/api/sonicos/interfaces/ipv4` - Retornou todas as interfaces
- `/api/sonicos/access-rules/ipv4` - Retornou regras de acesso
- `/api/sonicos/nat-policies/ipv4` - Retornou NAT policies

**Endpoints que falharam (HTTP 400):**
- `/api/sonicos/reporting/status` - Erro: "API endpoint is incomplete"
- `/api/sonicos/security-services/gateway-anti-virus/base` - Erro: "API endpoint is incomplete"
- `/api/sonicos/security-services/intrusion-prevention/base` - Erro: "API endpoint is incomplete"
- E todos os outros com sufixo `/base`, `/filter`, `/settings`

### Causa Raiz

O SonicOS 7.x não usa sufixos como `/base` ou `/filter` para acessar configurações de módulos de segurança. Os endpoints corretos são mais simples, sem esses sufixos. A documentação indica:

1. Recursos de configuração base não precisam de sufixo
2. Endpoints de `/reporting/` para status do sistema
3. Certos endpoints retornam coleções que precisam apenas do nome do módulo

---

## Correções Necessárias

### Tabela de Endpoints Corrigidos (Baseado nos Testes)

| Step ID | Path Atual (Incorreto) | Path Correto |
|---------|------------------------|--------------|
| `system_status` | `/api/sonicos/reporting/status` | `/api/sonicos/config/current` |
| `gateway_av` | `/api/sonicos/security-services/gateway-anti-virus/base` | `/api/sonicos/security-services/gateway-anti-virus` |
| `ips` | `/api/sonicos/security-services/intrusion-prevention/base` | `/api/sonicos/security-services/intrusion-prevention` |
| `anti_spyware` | `/api/sonicos/security-services/anti-spyware/base` | `/api/sonicos/security-services/anti-spyware` |
| `app_control` | `/api/sonicos/security-services/app-control/policies` | `/api/sonicos/security-services/app-control/advanced` |
| `content_filter` | `/api/sonicos/security-services/content-filter/profiles` | `/api/sonicos/security-services/content-filter` |
| `geo_ip` | `/api/sonicos/security-services/geo-ip/filter` | `/api/sonicos/security-services/geo-ip` |
| `botnet` | `/api/sonicos/security-services/botnet/filter` | `/api/sonicos/security-services/botnet` |
| `vpn_ssl` | `/api/sonicos/vpn/ssl-vpn/server` | `/api/sonicos/vpn/ssl-vpn/server/settings` |
| `vpn_ipsec` | `/api/sonicos/vpn/policies/ipv4` | `/api/sonicos/vpn/policies/ipv4` (manter) |
| `log_settings` | `/api/sonicos/log/settings` | `/api/sonicos/log` |
| `administration` | `/api/sonicos/administration/settings` | `/api/sonicos/administration` |
| `licenses` | `/api/sonicos/reporting/licenses` | `/api/sonicos/licenses` |

---

## Implementação

### Alteração: Migração SQL

Atualizar o blueprint com os novos paths corrigidos (sem os sufixos `/base`, `/filter`):

```sql
UPDATE device_blueprints 
SET collection_steps = '{
  "steps": [
    {
      "id": "auth_login",
      "type": "http_session",
      "action": "login",
      "method": "POST",
      "path": "/api/sonicos/auth",
      "headers": {"Content-Type": "application/json"},
      "body_template": "{\"user\": \"{{auth_username}}\", \"password\": \"{{auth_password}}\"}",
      "save_session": true
    },
    {"id": "version", "type": "http_request", "method": "GET", "path": "/api/sonicos/version", "use_session": true},
    {"id": "interfaces", "type": "http_request", "method": "GET", "path": "/api/sonicos/interfaces/ipv4", "use_session": true},
    {"id": "access_rules", "type": "http_request", "method": "GET", "path": "/api/sonicos/access-rules/ipv4", "use_session": true},
    {"id": "nat_policies", "type": "http_request", "method": "GET", "path": "/api/sonicos/nat-policies/ipv4", "use_session": true},
    {"id": "gateway_av", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/gateway-anti-virus", "use_session": true},
    {"id": "ips", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/intrusion-prevention", "use_session": true},
    {"id": "anti_spyware", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/anti-spyware", "use_session": true},
    {"id": "app_control", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/app-control/advanced", "use_session": true},
    {"id": "content_filter", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/content-filter", "use_session": true},
    {"id": "geo_ip", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/geo-ip", "use_session": true},
    {"id": "botnet", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/botnet", "use_session": true},
    {"id": "vpn_ssl", "type": "http_request", "method": "GET", "path": "/api/sonicos/vpn/ssl-vpn/server/settings", "use_session": true},
    {"id": "vpn_ipsec", "type": "http_request", "method": "GET", "path": "/api/sonicos/vpn/policies/ipv4", "use_session": true},
    {"id": "log_settings", "type": "http_request", "method": "GET", "path": "/api/sonicos/log", "use_session": true},
    {"id": "administration", "type": "http_request", "method": "GET", "path": "/api/sonicos/administration", "use_session": true},
    {"id": "licenses", "type": "http_request", "method": "GET", "path": "/api/sonicos/licenses", "use_session": true},
    {
      "id": "auth_logout",
      "type": "http_session",
      "action": "logout",
      "method": "DELETE",
      "path": "/api/sonicos/auth",
      "use_session": true
    }
  ]
}'::jsonb,
updated_at = now()
WHERE id = 'f1c656c0-75ed-43c6-b0a3-696498833094';
```

---

## Resultado Esperado

Após a correção:
1. Endpoints de Security Services retornarão HTTP 200 com dados de configuração
2. O relatório de compliance mostrará o status real de cada módulo (habilitado/desabilitado)
3. O score de compliance será calculado com dados reais do dispositivo

---

## Nota sobre Documentação

Os endpoints da API SonicOS 7.x podem variar entre versões específicas de firmware. Se alguns endpoints ainda falharem, a estratégia recomendada é:

1. Usar o Swagger interno do SonicWall (acessível via `https://<firewall-ip>/api/sonicos/openapi`) para validar endpoints disponíveis
2. Adicionar mais logging no agente para capturar o response body completo dos erros
3. Testar endpoints individualmente via curl antes de adicionar ao blueprint

