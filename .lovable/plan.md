

# Plano: Enriquecer Coleta e Compliance do SonicWall

## Situação Atual

| Aspecto | FortiGate | SonicWall |
|---------|-----------|-----------|
| Regras de Compliance | 24 | 6 |
| Endpoints coletados | 18+ | 3 |
| Categorias | 11 | 4 |

O SonicWall está coletando apenas:
- `/api/sonicos/version` - Informações do sistema
- `/api/sonicos/interfaces/ipv4` - Interfaces de rede
- `/api/sonicos/access-rules/ipv4` - Regras de acesso

## Endpoints SonicOS Disponíveis para Expansão

Baseado na API do SonicOS 7.x, podemos coletar:

| Categoria | Endpoint | Dados |
|-----------|----------|-------|
| **Gateway AV** | `/api/sonicos/gateway-anti-virus` | Status global do antivírus |
| **IPS** | `/api/sonicos/intrusion-prevention` | Prevenção de intrusão |
| **Anti-Spyware** | `/api/sonicos/anti-spyware` | Proteção contra spyware |
| **App Control** | `/api/sonicos/app-control` | Controle de aplicações |
| **Content Filter** | `/api/sonicos/content-filter-v3` | Filtragem de conteúdo |
| **Geo-IP** | `/api/sonicos/geo-ip-filter` | Filtro geográfico |
| **Botnet** | `/api/sonicos/botnet-filter` | Proteção contra botnets |
| **NAT Policies** | `/api/sonicos/nat-policies/ipv4` | Regras NAT |
| **VPN SSL** | `/api/sonicos/vpn/ssl` | Configuração SSL VPN |
| **VPN IPsec** | `/api/sonicos/vpn/ipsec` | Túneis IPsec |
| **Zones** | `/api/sonicos/zones` | Configuração de zonas |
| **Logging** | `/api/sonicos/log/settings` | Configurações de log |
| **Admin** | `/api/sonicos/administration` | Configurações administrativas |
| **Users** | `/api/sonicos/users/local` | Usuários locais |

## Regras de Compliance Propostas (18 novas)

### Segurança de Perímetro (UTM)
| Código | Nome | Severidade |
|--------|------|------------|
| SW_GAV_ENABLED | Gateway Antivírus Ativo | high |
| SW_IPS_ENABLED | Prevenção de Intrusão Ativa | high |
| SW_ANTISPYWARE | Anti-Spyware Ativo | high |
| SW_APPCONTROL | Controle de Aplicações | medium |
| SW_CONTENTFILTER | Filtro de Conteúdo Ativo | medium |

### Políticas de Segurança
| Código | Nome | Severidade |
|--------|------|------------|
| SW_ANY_ANY_RULES | Regras "Any-Any" | critical |
| SW_RDP_EXPOSED | RDP Exposto para Internet | critical |
| SW_SMB_EXPOSED | SMB Exposto para Internet | critical |

### VPN
| Código | Nome | Severidade |
|--------|------|------------|
| SW_IPSEC_CRYPTO | Criptografia IPsec Forte | high |
| SW_SSLVPN_ENABLED | SSL VPN Configurado | medium |

### Sistema e Administração
| Código | Nome | Severidade |
|--------|------|------------|
| SW_HTTPS_ADMIN | Gerência via HTTPS | critical |
| SW_SSH_TIMEOUT | Timeout de Sessão Admin | medium |
| SW_SYSLOG_ENABLED | Envio de Logs Syslog | medium |

### Licenciamento
| Código | Nome | Severidade |
|--------|------|------------|
| SW_LICENSE_ACTIVE | Licenças de Segurança Ativas | high |
| SW_SUPPORT_ACTIVE | Suporte Ativo | critical |

### Zonas e Interfaces
| Código | Nome | Severidade |
|--------|------|------------|
| SW_ZONE_SECURITY | Serviços de Segurança por Zona | high |
| SW_STEALTH_MODE | Modo Stealth nas Interfaces WAN | medium |

---

## Alterações Técnicas

### 1. Atualizar Blueprint do SonicWall (SQL)

Adicionar novos steps de coleta no `collection_steps` do blueprint existente:

```json
{
  "steps": [
    // ... steps existentes (auth_login, version, interfaces, access_rules) ...
    { "id": "gateway_av", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/gateway-anti-virus" }},
    { "id": "ips", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/intrusion-prevention" }},
    { "id": "anti_spyware", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/anti-spyware" }},
    { "id": "app_control", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/app-control" }},
    { "id": "content_filter", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/content-filter-v3" }},
    { "id": "geo_ip", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/geo-ip-filter" }},
    { "id": "botnet", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/botnet-filter" }},
    { "id": "nat_policies", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/nat-policies/ipv4" }},
    { "id": "vpn_ssl", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/vpn/ssl" }},
    { "id": "vpn_ipsec", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/vpn/ipsec" }},
    { "id": "zones", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/zones" }},
    { "id": "log_settings", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/log/settings" }},
    { "id": "administration", "executor": "http_session", "config": { "action": "request", "method": "GET", "path": "/api/sonicos/administration" }},
    // auth_logout permanece como último step
  ]
}
```

### 2. Inserir Novas Regras de Compliance (SQL)

Criar 18 novas regras com `evaluation_logic` específica para cada verificação, seguindo o padrão já estabelecido.

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | UPDATE do blueprint + INSERT de 18 novas regras |

---

## Resultado Esperado

Após a migração:
1. O blueprint do SonicWall coletará 14+ endpoints (vs 3 atuais)
2. 24 regras de compliance (vs 6 atuais) - paridade com FortiGate
3. Relatórios mais completos com categorias equivalentes
4. Score de segurança mais preciso e detalhado

---

## Observação Importante

As regras de `evaluation_logic` serão baseadas na estrutura esperada da API SonicOS. Após a primeira coleta com o blueprint atualizado, pode ser necessário ajustar os `field_path` das regras conforme a estrutura real do JSON retornado pelo dispositivo.

