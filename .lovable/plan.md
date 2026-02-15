
# Fix: Firewall ainda nao aparece no Mapa de Ataques

## Diagnostico

A chamada `ipapi.co/200.170.138.44/json/` retornou dados validos (lat: -16.8428, lng: -49.2468) no log de rede. Isso indica que a geolocalizacao ESTA funcionando no backend, mas o dado nao esta chegando ao componente `AttackMap`. 

Duas causas provaveis:

1. **Cache do React Query**: A versao anterior do codigo (com `ipwho.is`) cacheou `null` com `staleTime` de 30 minutos. Mesmo apos trocar para `ipapi.co`, se o `queryKey` for identico, o React Query serve o resultado cacheado `null` sem re-executar a `queryFn`. O request que aparece no log pode ser de uma selecao diferente de firewall.

2. **Problema sutil na condicao `enabled`**: A query depende de `!!snapshot`, mas quando o usuario troca de firewall, o `snapshot` anterior pode ser invalidado momentaneamente (ficando `undefined`), desabilitando a query geo. Quando o novo snapshot carrega, a query geo pode nao re-executar se o cache antigo (do firewall anterior) ainda estiver valido.

## Solucao

Tres correcoes no arquivo `src/pages/firewall/AnalyzerDashboardPage.tsx`:

### 1. Adicionar `selectedFirewall` ao queryKey

Garantir que trocar de firewall sempre invalida o cache de geolocalizacao:

```typescript
queryKey: [
  'firewall-geo-v2',  // mudanca de nome para invalidar cache antigo
  selectedFirewall,    // NOVO - invalida ao trocar firewall
  firewallHostname,
  snapshot?.metrics?.topAuthIPsSuccess?.[0]?.ip,
  snapshot?.metrics?.topAuthIPsFailed?.[0]?.ip,
],
```

### 2. Reduzir staleTime para 5 minutos

O staleTime de 30 minutos e excessivo para dados de geolocalizacao que mudam com a selecao de firewall:

```typescript
staleTime: 1000 * 60 * 5,  // 5 min em vez de 30 min
```

### 3. Adicionar log de debug temporario

Para confirmar se a funcao esta executando e qual resultado retorna:

```typescript
console.log('[firewall-geo] result:', result);
```

Isso sera removido apos confirmar o funcionamento.

## Detalhes tecnicos

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Modificar a query `firewall-geo` (linhas 223-275):

- Renomear queryKey de `'firewall-geo'` para `'firewall-geo-v2'` para invalidar qualquer cache residual do ipwho.is
- Adicionar `selectedFirewall` como primeiro elemento variavel do queryKey
- Reduzir `staleTime` de 30 min para 5 min
- Adicionar `console.log` para debug do resultado final antes de retornar

Essas mudancas garantem que:
- Cache antigo (ipwho.is que retornava null) e completamente ignorado
- Trocar de firewall sempre dispara nova geolocalizacao
- O resultado e visivel no console para debug
