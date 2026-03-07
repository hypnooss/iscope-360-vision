

## Correção: Service Health não traz dados — Decriptação do secret incorreta

### Causa Raiz

A edge function `m365-service-health` usa uma função `decryptSecret` **simplificada** que, para secrets sem `:` (formato base64 legacy), faz apenas `atob(encrypted)` — devolvendo bytes brutos em vez do secret decriptado.

O `m365-analyzer` (que funciona) usa uma lógica de decriptação **em duas camadas**:
1. **Hex** (`iv:ciphertext` com `:`) — `decryptSecretHex` com AES-GCM
2. **Base64 legacy** (sem `:`) — `decryptSecretBase64` com AES-GCM usando `TextEncoder` para derivar a chave

Os tenants do usuário usam `multi_tenant_app` sem `client_secret_encrypted` próprio, caindo para o `m365_global_config`. O secret global existe mas está em formato que requer decriptação AES-GCM real — não um simples `atob()`.

### Solução

Substituir as funções `hex()` e `decryptSecret()` no `m365-service-health/index.ts` pela mesma lógica unificada do `m365-analyzer`:
- `decryptSecretHex()` para formato hex com `:`
- `decryptSecretBase64()` para formato base64 legacy
- `decryptSecret()` unificada que tenta hex primeiro, depois base64

### Arquivo

**`supabase/functions/m365-service-health/index.ts`** — substituir as funções de decriptação (linhas 10-21) pela lógica completa do analyzer.

