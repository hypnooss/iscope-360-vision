
# Plano: Corrigir Endpoints da API SonicOS 7.x no Blueprint

## Problema Identificado

O login/logout agora funcionam corretamente, mas os endpoints de coleta estão retornando erros HTTP porque os paths no blueprint não seguem a estrutura correta da API SonicOS 7.x:

- **HTTP 404**: Recurso não existe no path especificado
- **HTTP 405**: Método não permitido (path existe mas não aceita GET)
- **HTTP 400**: Requisição malformada (path parcialmente correto)

### Causa Raiz
A API SonicOS 7.x usa namespaces específicos:
- `/security-services/` para módulos de segurança (AV, IPS, Anti-Spyware, etc.)
- `/reporting/` para status e licenças
- Sufixos específicos como `/base`, `/filter`, `/status`

---

## Correções Necessárias

### Tabela de Endpoints Corrigidos

| Step ID | Path Atual (Errado) | Path Correto |
|---------|---------------------|--------------|
| `system_status` | `/api/sonicos/reporting/system/status` | `/api/sonicos/reporting/status` |
| `gateway_av` | `/api/sonicos/gateway-anti-virus/base` | `/api/sonicos/security-services/gateway-anti-virus/base` |
| `ips` | `/api/sonicos/intrusion-prevention/base` | `/api/sonicos/security-services/intrusion-prevention/base` |
| `anti_spyware` | `/api/sonicos/anti-spyware/base` | `/api/sonicos/security-services/anti-spyware/base` |
| `app_control` | `/api/sonicos/app-control/policies` | `/api/sonicos/security-services/app-control/policies` |
| `geo_ip` | `/api/sonicos/geo-ip/base` | `/api/sonicos/security-services/geo-ip/filter` |
| `botnet` | `/api/sonicos/botnet/base` | `/api/sonicos/security-services/botnet/filter` |
| `content_filter` | `/api/sonicos/content-filter/profiles` | `/api/sonicos/security-services/content-filter/profiles` |
| `vpn_ssl` | `/api/sonicos/ssl-vpn/server/settings` | `/api/sonicos/vpn/ssl-vpn/server` |
| `vpn_ipsec` | `/api/sonicos/vpn/policies/site-to-site/ipv4` | `/api/sonicos/vpn/policies/ipv4` |
| `log_settings` | `/api/sonicos/log/automation` | `/api/sonicos/log/settings` |
| `administration` | `/api/sonicos/administration/base-settings` | `/api/sonicos/administration/settings` |
| `licenses` | `/api/sonicos/licenses/status` | `/api/sonicos/reporting/licenses` |

---

## Implementação

### Alteração: Migração SQL

Atualizar o blueprint `f1c656c0-75ed-43c6-b0a3-696498833094` com os paths corrigidos:

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
    {"id": "system_status", "type": "http_request", "method": "GET", "path": "/api/sonicos/reporting/status", "use_session": true},
    {"id": "version", "type": "http_request", "method": "GET", "path": "/api/sonicos/version", "use_session": true},
    {"id": "interfaces", "type": "http_request", "method": "GET", "path": "/api/sonicos/interfaces/ipv4", "use_session": true},
    {"id": "access_rules", "type": "http_request", "method": "GET", "path": "/api/sonicos/access-rules/ipv4", "use_session": true},
    {"id": "nat_policies", "type": "http_request", "method": "GET", "path": "/api/sonicos/nat-policies/ipv4", "use_session": true},
    {"id": "gateway_av", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/gateway-anti-virus/base", "use_session": true},
    {"id": "ips", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/intrusion-prevention/base", "use_session": true},
    {"id": "anti_spyware", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/anti-spyware/base", "use_session": true},
    {"id": "app_control", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/app-control/policies", "use_session": true},
    {"id": "content_filter", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/content-filter/profiles", "use_session": true},
    {"id": "geo_ip", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/geo-ip/filter", "use_session": true},
    {"id": "botnet", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/botnet/filter", "use_session": true},
    {"id": "vpn_ssl", "type": "http_request", "method": "GET", "path": "/api/sonicos/vpn/ssl-vpn/server", "use_session": true},
    {"id": "vpn_ipsec", "type": "http_request", "method": "GET", "path": "/api/sonicos/vpn/policies/ipv4", "use_session": true},
    {"id": "log_settings", "type": "http_request", "method": "GET", "path": "/api/sonicos/log/settings", "use_session": true},
    {"id": "administration", "type": "http_request", "method": "GET", "path": "/api/sonicos/administration/settings", "use_session": true},
    {"id": "licenses", "type": "http_request", "method": "GET", "path": "/api/sonicos/reporting/licenses", "use_session": true},
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
1. Todos os endpoints retornarão HTTP 200 com dados JSON
2. O relatório de compliance terá dados reais do SonicWall
3. O score será calculado corretamente baseado nas configurações do dispositivo

---

## Observação Importante

Os paths exatos podem variar dependendo da versão específica do SonicOS. Se alguns endpoints ainda falharem após esta correção, podemos:
1. Analisar o response body dos erros para entender o problema
2. Consultar a documentação específica da versão do firmware
3. Testar manualmente os endpoints via cURL no ambiente do cliente
