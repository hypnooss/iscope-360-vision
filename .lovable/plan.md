
# Plano: Descoberta Dinâmica de Endpoints SonicOS 7.x

## Diagnóstico Final

Após múltiplas tentativas, identificamos que:
1. **Os endpoints básicos funcionam**: `version`, `interfaces`, `access-rules`, `nat-policies` retornam dados válidos
2. **Security Services falham**: Todos retornam `E_INVALID_API_CALL: API endpoint is incomplete`
3. **O firmware é SonicOS 7.3.0-7012**: A estrutura da API pode variar entre versões

## Causa Raiz

A documentação pública da SonicWall não reflete exatamente os endpoints disponíveis em cada versão de firmware. Cada build pode ter variações sutis na estrutura da API.

## Solução Proposta

### Fase 1: Adicionar Step de Descoberta no Blueprint

Adicionar um step que consulta o OpenAPI/Swagger interno do firewall para obter a lista de endpoints disponíveis:

```text
Novo step: openapi_discovery
Path: /api/sonicos/openapi
ou
Path: /api/sonicos/doc (alternativa)
```

Este endpoint retorna a especificação OpenAPI com todos os paths válidos para aquele firmware específico.

### Fase 2: Simplificar Blueprint para Endpoints Conhecidos

Enquanto não temos a descoberta automática, usar apenas os endpoints que sabemos que funcionam:

| Step | Path | Status |
|------|------|--------|
| version | /api/sonicos/version | Funciona |
| interfaces | /api/sonicos/interfaces/ipv4 | Funciona |
| access_rules | /api/sonicos/access-rules/ipv4 | Funciona |
| nat_policies | /api/sonicos/nat-policies/ipv4 | Funciona |
| zones | /api/sonicos/zones | A testar |
| address_objects | /api/sonicos/address-objects/ipv4 | A testar |
| service_objects | /api/sonicos/service-objects | A testar |

### Fase 3: Ajustar Compliance Rules

Atualizar as `compliance_rules` para calcular score baseado nos dados que realmente conseguimos coletar:
- DPI habilitado nas access-rules
- Logging habilitado
- Regras Any-Any detectadas
- Zonas configuradas corretamente

## Implementação

### 1. Atualizar Blueprint com Endpoints Funcionais + OpenAPI Discovery

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
    {"id": "openapi", "type": "http_request", "method": "GET", "path": "/api/sonicos/openapi", "use_session": true, "optional": true},
    {"id": "version", "type": "http_request", "method": "GET", "path": "/api/sonicos/version", "use_session": true},
    {"id": "interfaces", "type": "http_request", "method": "GET", "path": "/api/sonicos/interfaces/ipv4", "use_session": true},
    {"id": "zones", "type": "http_request", "method": "GET", "path": "/api/sonicos/zones", "use_session": true},
    {"id": "access_rules", "type": "http_request", "method": "GET", "path": "/api/sonicos/access-rules/ipv4", "use_session": true},
    {"id": "nat_policies", "type": "http_request", "method": "GET", "path": "/api/sonicos/nat-policies/ipv4", "use_session": true},
    {"id": "address_objects", "type": "http_request", "method": "GET", "path": "/api/sonicos/address-objects/ipv4", "use_session": true},
    {"id": "service_objects", "type": "http_request", "method": "GET", "path": "/api/sonicos/service-objects", "use_session": true},
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

### 2. Atualizar Compliance Rules para Usar Dados Disponíveis

Ajustar as regras para avaliar:
- `SW_DPI_ENABLED`: Verificar `access_rules[].dpi = true`
- `SW_LOGGING_ENABLED`: Verificar `access_rules[].logging = true`
- `SW_ANY_ANY_RULES`: Verificar regras com `source.any = true` AND `destination.any = true`
- `SW_ZONE_SECURITY`: Verificar configuração de zonas

## Benefícios

1. **Score realista**: Baseado em dados que conseguimos coletar
2. **Sem loops de teste**: Blueprint usa apenas endpoints funcionais
3. **Descoberta futura**: O step `openapi` retornará a lista completa de endpoints disponíveis

## Resultado Esperado

- Score de compliance calculado com sucesso
- Checks de DPI, Logging e regras Any-Any funcionando
- Dados de zonas e objetos disponíveis para análise adicional
