
# Plano: Corrigir Limite Máximo do $top para Sign-Ins

## Problema Identificado

A Microsoft Graph API para `auditLogs/signIns` tem um **limite máximo de 999** para o parâmetro `$top`:

> "$top accepts a minimum value of 1 and a maximum value of 999 (inclusive)"

Quando solicitamos `$top=1077` (359 usuários × 3), a API ignora o valor e não retorna os dados esperados, resultando em `loginCountries: []`.

## Solução

Ajustar o limite máximo de 5000 para **999** na fórmula de cálculo.

### Alteração no Código

**Arquivo:** `supabase/functions/m365-security-posture/index.ts`

**Linha 204 - Antes:**
```typescript
const signInSampleSize = Math.min(Math.max(metrics.activeUsers * 3, 500), 5000);
```

**Depois:**
```typescript
// Microsoft Graph signIns API has a maximum $top limit of 999
const signInSampleSize = Math.min(Math.max(metrics.activeUsers * 3, 500), 999);
```

### Adicionar Log de Debug

Para diagnosticar problemas futuros, adicionar um log caso a resposta não contenha dados:

```typescript
const { data: signIns, error: signInsError } = await graphFetchSafe(
  accessToken,
  `/auditLogs/signIns?$select=location,status&$top=${signInSampleSize}`,
  { beta: true }
);

if (signInsError) {
  console.error('[collectEnvironmentMetrics] Sign-in fetch error:', signInsError);
}

if (signIns?.value) {
  // ... processamento existente
} else {
  console.warn('[collectEnvironmentMetrics] Sign-in data is empty or missing .value');
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Alterar limite máximo de 5000 para 999 e adicionar logs de debug |

---

## Nova Fórmula

```
eventos = min(max(activeUsers × 3, 500), 999)
```

| Usuários Ativos | Fórmula (×3) | Valor Final |
|-----------------|--------------|-------------|
| 50              | 150          | **500** (mínimo) |
| 200             | 600          | **600** |
| 300             | 900          | **900** |
| 359             | 1077         | **999** (máximo) |
| 500+            | 1500+        | **999** (máximo) |

---

## Nota sobre Paginação

Para ambientes maiores que necessitem de mais de 999 eventos, seria necessário implementar paginação usando `@odata.nextLink`. Isso pode ser uma melhoria futura, mas para a maioria dos casos de uso, 999 eventos recentes são representativos o suficiente para a análise de origem de autenticação.
