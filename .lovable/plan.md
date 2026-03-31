

## Plano: Endpoint POST /v1/domains para cadastrar domínio via API

### O que será feito

Adicionar um novo endpoint `POST /v1/domains` no `api-gateway` que permite criar um domínio externo no workspace associado à API key, e um novo scope `external_domain:write` para controlar essa permissão.

### Alterações

**1. Edge Function `api-gateway/index.ts`**

Adicionar rota `POST /v1/domains` (sem `resourceId`) que:
- Exige scope `external_domain:write`
- Recebe body JSON: `{ domain: string, agent_id?: string }`
- Valida domínio (não vazio, formato básico)
- Verifica duplicata no workspace (`client_id` + `domain`)
- Se `agent_id` fornecido, valida que o agent pertence ao `client_id` da key
- Insere na tabela `external_domains` com: `client_id` (da key), `domain`, `name` (= domain), `agent_id`, `status: 'pending'`
- Retorna 201 com `{ domain: { id, domain, status, created_at } }`

**2. Frontend — Scope novo**

Adicionar `external_domain:write` nos componentes:
- `ApiKeyScopesSelect.tsx` — novo checkbox "Cadastro" com descrição
- `ApiAccessManagement.tsx` — label no `SCOPE_LABELS`

**3. Documentação inline**

Atualizar o card de documentação no `ApiAccessManagement.tsx` com exemplo curl do novo endpoint.

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/api-gateway/index.ts` | Nova rota POST /v1/domains |
| `src/components/admin/ApiKeyScopesSelect.tsx` | Scope `external_domain:write` |
| `src/components/admin/ApiAccessManagement.tsx` | Label + doc curl |

### Exemplo de uso

```bash
curl -X POST \
  https://akbosdbyheezghieiefz.supabase.co/functions/v1/api-gateway/v1/domains \
  -H "x-api-key: isk_..." \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "agent_id": "uuid-opcional"}'
```

Resposta 201:
```json
{
  "domain": {
    "id": "uuid",
    "domain": "example.com",
    "status": "pending",
    "created_at": "2026-03-31T..."
  }
}
```

