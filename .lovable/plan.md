

# Corrigir Credenciais SonicWall e Criptografar Dados Sensíveis

## Situacao Atual

1. **Problema imediato**: O firewall SONICWALL no banco tem `auth_password = "Mudar@1234"` mas `auth_username = NULL`. Isso causa o erro "No username/password in context" no agente.
2. **Tela de edicao**: A tela `/scope-firewall/firewalls/:id/edit` ja possui os campos de Usuario e Senha para dispositivos SonicWall. Funciona corretamente -- basta o usuario preencher o username e salvar.
3. **Credenciais em texto plano**: Todos os campos sensiveis (`api_key`, `auth_username`, `auth_password`) estao armazenados sem criptografia na tabela `firewalls`. Isso e um risco de seguranca.

## Plano

### Parte 1 - Criptografia de Credenciais

Seguir o mesmo padrao ja usado no M365 (`M365_ENCRYPTION_KEY` com AES-256-GCM, formato `iv:ciphertext` em hexadecimal).

#### 1.1 Criar Edge Function `manage-firewall-credentials`

Nova Edge Function responsavel por:
- Receber credenciais em texto plano do frontend
- Criptografar com AES-256-GCM usando uma nova secret `FIREWALL_ENCRYPTION_KEY` (ou reutilizar `M365_ENCRYPTION_KEY`)
- Salvar os valores criptografados no banco
- Retornar sucesso/erro

Operacoes suportadas:
- `save`: Recebe `firewall_id` + credenciais, criptografa e salva via UPDATE
- `read`: Recebe `firewall_id`, retorna credenciais descriptografadas (para preencher o formulario de edicao)

#### 1.2 Modificar o Frontend (AddFirewallDialog e FirewallEditPage)

**Ao salvar**:
- Em vez de fazer `supabase.from('firewalls').insert/update` com credenciais em texto plano, chamar a Edge Function `manage-firewall-credentials` para salvar credenciais separadamente
- O insert/update do firewall continua salvando os campos nao-sensiveis normalmente, mas com `api_key = ''`, `auth_username = null`, `auth_password = null` (os valores criptografados ficam nos mesmos campos)

Na verdade, mais simples: salvar os campos criptografados diretamente nos mesmos campos existentes (`api_key`, `auth_username`, `auth_password`), mas com o valor criptografado no formato `iv:ciphertext`.

**Ao carregar para edicao**:
- Chamar a Edge Function com operacao `read` para obter os valores descriptografados e popular o formulario

#### 1.3 Modificar a Edge Function `agent-tasks`

Apos obter as tasks via RPC, descriptografar as credenciais antes de enviar ao agente:
- Detectar se o valor esta criptografado (formato `iv:ciphertext` hexadecimal)
- Descriptografar usando a mesma chave
- Retornar valores em texto plano ao agente (o agente nao precisa mudar)

Isso significa que **o agente Python nao precisa de nenhuma alteracao** -- ele continuara recebendo credenciais em texto plano via HTTPS, como hoje.

### Parte 2 - Migrar Dados Existentes

Criar um script SQL (ou edge function one-time) para criptografar todas as credenciais existentes no banco. Isso pode ser feito pela edge function `manage-firewall-credentials` com uma operacao `migrate-all` chamada manualmente.

## Arquivos a Modificar/Criar

| Arquivo | Acao |
|---|---|
| `supabase/functions/manage-firewall-credentials/index.ts` | **Criar** - Edge Function para criptografar/descriptografar credenciais |
| `supabase/config.toml` | Adicionar configuracao da nova edge function |
| `src/pages/firewall/FirewallEditPage.tsx` | Usar edge function para salvar e carregar credenciais |
| `src/components/firewall/AddFirewallDialog.tsx` | Usar edge function para salvar credenciais na criacao |
| `src/pages/firewall/FirewallListPage.tsx` | Ajustar `handleAddFirewall` para usar edge function |
| `supabase/functions/agent-tasks/index.ts` | Descriptografar credenciais antes de enviar ao agente |

## Detalhes Tecnicos

### Funcoes de criptografia (Edge Function)

Reutilizar o padrao M365 existente:

```text
encrypt(plaintext, key):
  iv = crypto.getRandomValues(12 bytes)
  ciphertext = AES-GCM.encrypt(plaintext, key, iv)
  return hex(iv) + ":" + hex(ciphertext)

decrypt(encrypted, key):
  [ivHex, ciphertextHex] = encrypted.split(":")
  plaintext = AES-GCM.decrypt(fromHex(ciphertextHex), key, fromHex(ivHex))
  return plaintext

isEncrypted(value):
  return value && value.includes(":") && /^[0-9a-f]+:[0-9a-f]+$/i.test(value)
```

### Chave de criptografia

Reutilizar o secret `M365_ENCRYPTION_KEY` (32 bytes / 64 hex chars) que ja existe no projeto, para evitar gestao de multiplas chaves. A mesma chave sera usada tanto para M365 quanto para firewalls.

### Fluxo de salvamento (criptografado)

```text
Frontend -> manage-firewall-credentials (encrypt) -> DB (valores criptografados)
```

### Fluxo de leitura pelo agente

```text
DB (valores criptografados) -> rpc_get_agent_tasks -> agent-tasks EF (decrypt) -> Agent (texto plano via HTTPS)
```

### Fluxo de edicao pelo usuario

```text
DB (valores criptografados) -> manage-firewall-credentials (decrypt) -> Frontend (texto plano no formulario)
```

## Ordem de Implementacao

1. Criar a Edge Function `manage-firewall-credentials` com encrypt/decrypt
2. Modificar `agent-tasks` para descriptografar credenciais
3. Modificar `FirewallEditPage` para usar a edge function
4. Modificar `AddFirewallDialog` / `FirewallListPage` para usar a edge function na criacao
5. Migrar dados existentes (criptografar credenciais ja salvas)
6. Adicionar `verify_jwt = false` na config.toml para a nova function (o auth sera validado internamente)

