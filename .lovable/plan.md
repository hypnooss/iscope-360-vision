

# Plano: Remover Campo Redundante "Home Tenant ID"

## Analise da Redundancia

O sistema atualmente possui dois campos com a mesma informacao:

| Campo | Localizacao | Valor |
|-------|-------------|-------|
| Tenant ID | Secao de Validacao | `aa4c9de9-9a98-41f7-9aa0-bfd6401fc27c` |
| Home Tenant ID | Secao separada abaixo | `aa4c9de9-9a98-41f7-9aa0-bfd6401fc27c` |

Ambos referem-se ao tenant onde o App Registration foi criado - logo, sao redundantes.

---

## Solucao

Remover a secao separada "Home Tenant ID" e usar o valor do campo "Tenant ID" (da validacao) automaticamente como `home_tenant_id` ao salvar.

---

## Alteracoes no Arquivo

### `src/pages/admin/SettingsPage.tsx`

1. **Remover estado `newHomeTenantId`** (linha 65)
   - O campo nao sera mais necessario

2. **Remover referencias ao estado** ao carregar config:
   - Linhas 442-443 e 470-471 (onde carrega `home_tenant_id` para `newHomeTenantId`)

3. **Atualizar funcao `handleSaveM365Config`** (linha 570):
   - Mudar de: `home_tenant_id: newHomeTenantId.trim() || undefined`
   - Para: `home_tenant_id: tenantIdForValidation.trim() || undefined`

4. **Remover propriedade `homeTenantId` do estado `m365Config`**:
   - Interface M365Config (linhas 37)
   - Inicializacao do estado (linha 57)
   - Todas as referencias ao m365Config.homeTenantId

5. **Remover secao da UI** (linhas 898-920):
   - Bloco inteiro do "Home Tenant ID (para Upload de Certificados)"

---

## Logica Simplificada

```text
Antes:
  Tenant ID (validacao) --> tenantIdForValidation
  Home Tenant ID --> newHomeTenantId --> salvo como home_tenant_id

Depois:
  Tenant ID (validacao) --> tenantIdForValidation --> salvo como home_tenant_id
```

O campo "Tenant ID" da secao de validacao agora serve dois propositos:
1. Identificar o tenant para validacao de permissoes
2. Identificar o tenant para upload de certificados

---

## Resultado

- Interface mais limpa sem campo duplicado
- Menos confusao para o usuario
- Mesma funcionalidade mantida

