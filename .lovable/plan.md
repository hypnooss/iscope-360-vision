

# Adicionar Shodan API Key

## O que sera feito

1. **Salvar o segredo `SHODAN_API_KEY`** como secret do Supabase (para uso direto nas Edge Functions)
2. **Registrar a chave Shodan no painel de gestao** adicionando-a ao array `MANAGED_KEYS` na edge function `manage-api-keys`

## Mudancas tecnicas

### 1. Secret do Supabase
Adicionar `SHODAN_API_KEY` com o valor fornecido como secret do projeto, para que a edge function `attack-surface-scan` consiga ler via `Deno.env.get("SHODAN_API_KEY")`.

### 2. Edge Function `supabase/functions/manage-api-keys/index.ts`
Adicionar um novo item ao array `MANAGED_KEYS` (linha ~11):

```typescript
{
  name: "SHODAN_API_KEY",
  label: "Shodan",
  description: "Usada para enriquecimento de IPs no Attack Surface Analyzer (portas, serviços, CVEs)",
},
```

Isso fara a chave Shodan aparecer automaticamente na aba "Chaves de API" em Administracao > Configuracoes, no mesmo padrao visual das chaves VirusTotal e SecurityTrails ja existentes.

### Resultado
- A edge function `attack-surface-scan` podera usar `Deno.env.get("SHODAN_API_KEY")` imediatamente
- No painel de Configuracoes, a chave Shodan aparecera com status "Configurada" (via variavel de ambiente) e podera ser gerenciada (atualizada/removida) como as demais

