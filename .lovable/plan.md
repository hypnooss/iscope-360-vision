

# Plano: Corrigir Erro na Configuração do Microsoft 365

## Problema Identificado

A Edge Function `update-m365-config` está falhando porque o segredo `M365_ENCRYPTION_KEY` **não está configurado** no Supabase.

O código verifica se a chave existe (linha 122-130):
```typescript
const encryptionKey = Deno.env.get('M365_ENCRYPTION_KEY');
if (!encryptionKey || encryptionKey.length !== 64) {
  return new Response(
    JSON.stringify({ error: 'Encryption key not configured. Contact administrator.' }),
    { status: 500 ... }
  );
}
```

### Requisitos da Chave
- Deve ter **64 caracteres hexadecimais** (representa 256 bits para AES-256-GCM)
- Exemplo de formato: `a1b2c3d4e5f6...` (64 caracteres hex)

## Solução

### Passo 1: Gerar uma Chave de Criptografia

Gerar uma chave AES-256 aleatória de 64 caracteres hex. Você pode usar este comando no terminal:

```bash
openssl rand -hex 32
```

Ou gerar manualmente uma string de 64 caracteres hexadecimais (0-9, a-f).

### Passo 2: Adicionar o Segredo no Supabase

1. Acesse o **Supabase Dashboard**
2. Navegue para **Settings → Edge Functions**
3. Na seção **Secrets**, adicione:
   - **Nome**: `M365_ENCRYPTION_KEY`
   - **Valor**: A chave gerada no passo 1 (64 caracteres hex)

Link direto: https://supabase.com/dashboard/project/akbosdbyheezghieiefz/settings/functions

### Passo 3: Testar Novamente

Após adicionar o segredo, tente salvar as configurações do M365 novamente na página Administração → Configurações → Microsoft 365.

## Por que essa chave é necessária?

O sistema usa criptografia AES-256-GCM para proteger o `Client Secret` do Azure App Registration. Isso garante que:
- O segredo nunca seja armazenado em texto puro no banco de dados
- Mesmo com acesso ao banco, o valor real do `Client Secret` não pode ser lido
- Há proteção adicional além das políticas RLS do Supabase

## Importante

- **Guarde essa chave em local seguro** - se perdê-la, você não conseguirá descriptografar os segredos existentes
- A chave deve ser a mesma em todos os ambientes (development, staging, production) se você quiser compartilhar os dados
- Não compartilhe essa chave em logs ou repositórios de código

