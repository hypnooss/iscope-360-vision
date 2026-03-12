

## Diagnóstico: Exchange Analyzer sem dados para alguns tenants

### Causa Raiz

A edge function `exchange-dashboard` retorna o resultado **sem o campo `success: true`** na resposta (linha 398):

```js
// Atual (linha 398):
return new Response(JSON.stringify(result), { ... });

// O scheduler espera:
if (!exchResult.success) { retry... }
```

Como `result` não tem `success`, o scheduler interpreta como falha e faz retry. Antes do fix de autenticação (aplicado hoje), ambas as tentativas falhavam com 401. Resultado: o cache do Exchange nunca foi gravado para tenants como IE MADEIRA.

Os caches de Entra ID e Collaboration sobreviveram porque foram populados em execuções anteriores e **não foram limpos** (só o Exchange foi zerado pelo UPDATE).

### Confirmação nos dados

| Tenant | Exchange Cache | Entra Cache | Collab Cache |
|---|---|---|---|
| IE MADEIRA | NULL | 10/03 15:02 | 07/03 17:44 |

### Correção

Alterar a resposta da `exchange-dashboard` para incluir `success: true` no objeto retornado, garantindo que o scheduler reconheça o sucesso:

```ts
// Linha 398 - Antes:
return new Response(JSON.stringify(result), { ... });

// Depois:
return new Response(JSON.stringify({ success: true, ...result }), { ... });
```

Verificar e aplicar o mesmo padrão em `entra-id-dashboard` e `collaboration-dashboard` para consistência.

### Ação Imediata

Enquanto o fix é aplicado, o usuário pode clicar em **"Executar Análise"** na página do Exchange Analyzer para IE MADEIRA — o botão chama a `exchange-dashboard` diretamente com JWT de usuário (que sempre funcionou), populando o cache imediatamente.

