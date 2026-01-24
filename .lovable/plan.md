

# Plano: Migração SQL para Device Type e Blueprint SonicWall

## Objetivo

Criar uma migração SQL que insira automaticamente o Device Type "SonicWall TZ" e seu Blueprint de coleta com os 5 steps necessários para a integração funcionar.

---

## Dados a Inserir

### 1. Device Type: SonicWall TZ

| Campo | Valor |
|-------|-------|
| name | SonicWall TZ |
| vendor | SonicWall |
| code | sonicwall_tz |
| category | firewall |
| icon | Shield |
| is_active | true |

### 2. Blueprint de Coleta

| Campo | Valor |
|-------|-------|
| name | SonicWall TZ - Coleta Padrão |
| description | Blueprint padrão para coleta de dados de firewalls SonicWall TZ via API REST com autenticação por sessão |
| version | 7.x |
| is_active | true |

**Steps do Blueprint:**

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
        "basic_auth": true,
        "verify_ssl": false
      }
    },
    {
      "id": "version",
      "executor": "http_session",
      "config": {
        "action": "request",
        "method": "GET",
        "path": "/api/sonicos/version",
        "headers": { "Accept": "application/json" }
      }
    },
    {
      "id": "interfaces",
      "executor": "http_session",
      "config": {
        "action": "request",
        "method": "GET",
        "path": "/api/sonicos/interfaces/ipv4",
        "headers": { "Accept": "application/json" }
      }
    },
    {
      "id": "access_rules",
      "executor": "http_session",
      "config": {
        "action": "request",
        "method": "GET",
        "path": "/api/sonicos/access-rules/ipv4",
        "headers": { "Accept": "application/json" }
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

---

## Alterações

### Arquivo Novo

**`supabase/migrations/[timestamp]_add_sonicwall_device_type_and_blueprint.sql`**

```sql
-- Inserir Device Type SonicWall TZ
INSERT INTO public.device_types (name, vendor, code, category, icon, is_active)
VALUES ('SonicWall TZ', 'SonicWall', 'sonicwall_tz', 'firewall', 'Shield', true)
ON CONFLICT (code) DO NOTHING;

-- Inserir Blueprint de coleta para SonicWall
INSERT INTO public.device_blueprints (name, description, version, device_type_id, is_active, collection_steps)
SELECT 
  'SonicWall TZ - Coleta Padrão',
  'Blueprint padrão para coleta de dados de firewalls SonicWall TZ via API REST com autenticação por sessão',
  '7.x',
  dt.id,
  true,
  '{"steps": [...]}'::jsonb
FROM public.device_types dt
WHERE dt.code = 'sonicwall_tz';
```

---

## Resultado Esperado

Após a migração:
1. O Device Type "SonicWall TZ" aparecerá em **Administração > Coletas > Firewalls > Tipos de Dispositivo**
2. O Blueprint aparecerá em **Administração > Coletas > Firewalls > Blueprints**
3. Será possível criar firewalls SonicWall e associá-los a agentes para coleta

---

## Próximos Passos (após esta migração)

1. **Criar Regras de Compliance** - Adicionar regras específicas para SonicWall (DPI, GeoIP, Botnet, etc.)
2. **Testar Coleta** - Cadastrar um firewall SonicWall e executar uma análise

