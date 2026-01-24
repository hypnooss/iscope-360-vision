
# Plano: Corrigir Endpoints SonicOS 7.x (Revisão Final)

## Problema Identificado

A API SonicOS 7.x continua retornando HTTP 400 porque:

1. **Nome incorreto do endpoint**: Usamos `gateway-anti-virus` mas o correto é `gateway-antivirus` (sem hífen)
2. **Falta do sufixo `/global`**: Security Services precisam de `/global` para acessar configurações
3. **Falta do sufixo `/settings`**: Geo-IP, Botnet, Log e Administration precisam de `/settings`

## Endpoints Corretos (Baseado na Documentação Oficial)

| Step ID | Path Atual (Incorreto) | Path Correto (Documentação) |
|---------|------------------------|----------------------------|
| `gateway_av` | `/api/sonicos/security-services/gateway-anti-virus` | `/api/sonicos/security-services/gateway-antivirus/global` |
| `ips` | `/api/sonicos/security-services/intrusion-prevention` | `/api/sonicos/security-services/intrusion-prevention/global` |
| `anti_spyware` | `/api/sonicos/security-services/anti-spyware` | `/api/sonicos/security-services/anti-spyware/global` |
| `app_control` | `/api/sonicos/security-services/app-control/advanced` | `/api/sonicos/security-services/app-control/advanced` (manter) |
| `content_filter` | `/api/sonicos/security-services/content-filter` | `/api/sonicos/security-services/content-filter/profiles` |
| `geo_ip` | `/api/sonicos/security-services/geo-ip` | `/api/sonicos/security-services/geo-ip/settings` |
| `botnet` | `/api/sonicos/security-services/botnet` | `/api/sonicos/security-services/botnet/settings` |
| `vpn_ssl` | `/api/sonicos/vpn/ssl-vpn/server/settings` | `/api/sonicos/vpn/ssl-vpn/server/settings` (manter) |
| `vpn_ipsec` | `/api/sonicos/vpn/policies/ipv4` | `/api/sonicos/vpn/policies/ipv4` (manter) |
| `log_settings` | `/api/sonicos/log` | `/api/sonicos/log/settings` |
| `administration` | `/api/sonicos/administration` | `/api/sonicos/administration/settings` |
| `licenses` | `/api/sonicos/licenses` | `/api/sonicos/reporting/licenses` |

---

## Implementação

### Alteração: UPDATE SQL no Blueprint

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
    {"id": "gateway_av", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/gateway-antivirus/global", "use_session": true},
    {"id": "ips", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/intrusion-prevention/global", "use_session": true},
    {"id": "anti_spyware", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/anti-spyware/global", "use_session": true},
    {"id": "app_control", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/app-control/advanced", "use_session": true},
    {"id": "content_filter", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/content-filter/profiles", "use_session": true},
    {"id": "geo_ip", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/geo-ip/settings", "use_session": true},
    {"id": "botnet", "type": "http_request", "method": "GET", "path": "/api/sonicos/security-services/botnet/settings", "use_session": true},
    {"id": "vpn_ssl", "type": "http_request", "method": "GET", "path": "/api/sonicos/vpn/ssl-vpn/server/settings", "use_session": true},
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

## Principais Correções

1. **gateway-antivirus**: Removido hífen extra e adicionado `/global`
2. **intrusion-prevention**: Adicionado `/global`
3. **anti-spyware**: Adicionado `/global`
4. **content-filter**: Mudado para `/profiles`
5. **geo-ip**: Adicionado `/settings`
6. **botnet**: Adicionado `/settings`
7. **log**: Adicionado `/settings`
8. **administration**: Adicionado `/settings`
9. **licenses**: Mudado para `/reporting/licenses`

---

## Resultado Esperado

Após esta correção baseada na documentação oficial:
- Security Services (GAV, IPS, Anti-Spyware) retornarão configurações globais
- Geo-IP e Botnet retornarão settings de filtragem
- Logs e Administration retornarão configurações do sistema
- O score de compliance será calculado com dados reais
