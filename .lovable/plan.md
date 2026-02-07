

# Plano: Refatorar Configuracao M365 com Validacao Unificada

## Contexto

Atualmente, a pagina de Configuracoes do Microsoft 365 tem duas secoes separadas:
1. **Configuracao Multi-Tenant** - com validacao de permissoes do Graph (funciona)
2. **Upload Automatico de Certificados** - configuracao de App Object ID e Home Tenant ID (sem validacao)

O usuario preencheu as informacoes de certificado mas nao tem como saber se esta funcionando.

---

## Problema Identificado

A secao de "Upload Automatico de Certificados" esta isolada e nao possui:
- Validacao se a permissao `Application.ReadWrite.OwnedBy` esta concedida
- Status de validacao visual (badge verde/vermelho)
- Monitoramento automatico
- Feedback sobre tentativas de upload

---

## Solucao Proposta

### Refatorar a UI para Unificar o Fluxo de Validacao

Reorganizar a secao de configuracao M365 para ter um unico ponto de validacao que verifica TUDO:
- Permissoes da Graph API (existente)
- Permissao de upload de certificado (`Application.ReadWrite.OwnedBy`)

### Nova Estrutura da Interface

```text
+-----------------------------------------------------------------------+
|  Configuracao Multi-Tenant do Microsoft 365        [Configurado]      |
|-----------------------------------------------------------------------|
|  Application (Client) ID     |     Client Secret                      |
|  [input]                     |     [password input]                   |
|-----------------------------------------------------------------------|
|  +-------------------------------------------------------------+      |
|  | Configuracao para Validacao e Monitoramento                 |      |
|  +-------------------------------------------------------------+      |
|  | Tenant ID         | App Object ID (opcional)                |      |
|  | [input]           | [input]                                 |      |
|  |                   | (para upload automatico de certificados)|      |
|  +-------------------------------------------------------------+      |
|  |                                    [Validar Configuracao]   |      |
|  +-------------------------------------------------------------+      |
|                                                                       |
|  Permissoes Validadas:                                                |
|  +-------------------+  +-------------------+  +-------------------+  |
|  | Obrigatorias      |  | Entra ID/Security |  | Exchange Online   |  |
|  | o User.Read.All   |  | o Group.Read.All  |  | o MailboxSettings |  |
|  | o Directory.Read  |  | o Application...  |  | o Mail.Read       |  |
|  +-------------------+  +-------------------+  +-------------------+  |
|                                                                       |
|  +-------------------+                                                |
|  | Upload Certificado|                                                |
|  | o Application.    |  <- Nova permissao a validar                   |
|  |   ReadWrite.OwnedBy                                                |
|  +-------------------+                                                |
|                                                                       |
|  +---------------------------------------------------------------+    |
|  | Monitoramento Automatico                                      |    |
|  | Ultima validacao: 07/02/2026 as 17:00 | Tenant: aa4c9de9...   |    |
|  +---------------------------------------------------------------+    |
+-----------------------------------------------------------------------+
```

---

## Alteracoes Tecnicas

### 1. Backend: Modificar `validate-m365-permissions/index.ts`

Adicionar validacao da permissao `Application.ReadWrite.OwnedBy`:

- Adicionar a permissao na lista de opcionais (categoria "Upload de Certificados")
- Implementar teste usando o endpoint: `GET /applications/{app_object_id}?$select=keyCredentials`
- Esta permissao so e testada se `app_object_id` estiver configurado

```text
Nova permissao opcional:
- Application.ReadWrite.OwnedBy (categoria: "Upload de Certificados")
  - Testada via: PATCH ou GET em /applications/{object_id}
  - Depende de: app_object_id e home_tenant_id configurados
```

### 2. Frontend: Refatorar `SettingsPage.tsx`

**Mudancas na UI:**

1. **Mover o campo App Object ID** para dentro da secao de validacao (ao lado do Tenant ID)
2. **Remover secao separada** de "Upload Automatico de Certificados"
3. **Adicionar nova coluna** de permissoes: "Upload de Certificados"
4. **Manter Home Tenant ID** na secao principal (junto com App ID e Client Secret)
5. **Atualizar botao** "Validar Permissoes" para "Validar Configuracao"

**Nova estrutura de campos:**

| Campo | Localizacao |
|-------|-------------|
| Application (Client) ID | Secao principal (2 colunas) |
| Client Secret | Secao principal (2 colunas) |
| Home Tenant ID | Secao principal (2 colunas - nova posicao) |
| Tenant ID para Validacao | Secao de validacao |
| App Object ID (opcional) | Secao de validacao (novo) |

### 3. Tipos: Atualizar Interface

```typescript
// Adicionar nova categoria de permissoes
const certificatePermissions = ['Application.ReadWrite.OwnedBy'];

// Atualizar M365Config para incluir status de certificado
interface M365Config {
  // ...campos existentes...
  certificatePermissionValidated: boolean;
}
```

### 4. Logica de Validacao Atualizada

A funcao de validacao recebera:
- `tenant_id`: para validar permissoes da Graph (obrigatorio)
- `app_object_id`: para validar permissao de certificado (opcional)

Se `app_object_id` for fornecido:
1. Tentar ler o app via Graph: `GET /applications/{app_object_id}?$select=id,keyCredentials`
2. Se sucesso (200): `Application.ReadWrite.OwnedBy` esta OK
3. Se falha (403): permissao nao concedida
4. Se falha (404): App Object ID incorreto

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/admin/SettingsPage.tsx` | Refatorar UI para layout unificado |
| `supabase/functions/validate-m365-permissions/index.ts` | Adicionar validacao de Application.ReadWrite.OwnedBy |
| `supabase/functions/get-m365-config/index.ts` | Retornar status de permissao de certificado |

---

## Nova Experiencia do Usuario

1. **Configuracao Inicial:**
   - Preenche App ID, Client Secret, Home Tenant ID (obrigatorios para M365)
   - Preenche Tenant ID para Validacao
   - Opcionalmente preenche App Object ID (para upload de certificados)

2. **Validacao:**
   - Clica em "Validar Configuracao"
   - Sistema testa TODAS as permissoes (Graph + Certificado se configurado)
   - Resultados aparecem em 4 colunas: Core, Entra ID, Exchange, Upload Certificados

3. **Monitoramento:**
   - Validacao automatica a cada hora (existente)
   - Inclui verificacao de permissao de certificado

---

## Secao Tecnica: Teste da Permissao de Certificado

A permissao `Application.ReadWrite.OwnedBy` permite que o app modifique apenas a si mesmo. Para validar:

```typescript
// Em validate-m365-permissions/index.ts
async function testCertificatePermission(
  accessToken: string, 
  appObjectId: string
): Promise<boolean> {
  // Tentar ler o app com keyCredentials
  const url = `https://graph.microsoft.com/v1.0/applications/${appObjectId}?$select=id,keyCredentials`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (response.ok) {
    console.log('Application.ReadWrite.OwnedBy: granted');
    return true;
  }
  
  const errorText = await response.text();
  console.log(`Application.ReadWrite.OwnedBy: denied (${response.status})`);
  return false;
}
```

---

## Beneficios

1. **Feedback imediato**: Usuario sabe se a configuracao de certificado esta funcionando
2. **Monitoramento continuo**: Permissoes sao verificadas automaticamente
3. **Interface simplificada**: Todas as configuracoes M365 em um lugar
4. **Diagnostico claro**: Coluna especifica mostra status da permissao de certificado

