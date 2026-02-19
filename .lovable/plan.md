
# Diagnóstico e Correções: Mapa Vazio + Tabela "Top Tráfego"

## Problemas identificados via banco de dados

A query ao snapshot mais recente revelou dois problemas distintos:

### Problema 1: Mapa de Ataques vazio — 2 causas raiz

**Causa A: Métricas de saída bloqueada faltando no snapshot salvo**

No arquivo `supabase/functions/firewall-analyzer/index.ts`, o objeto `metrics` salvo no banco (linhas 1111-1114) inclui apenas:
```ts
topOutboundIPs: outboundResult.metrics.topOutboundIPs || [],
topOutboundCountries: outboundResult.metrics.topOutboundCountries || [],
outboundConnections: outboundResult.metrics.outboundConnections || 0,
```
Os campos `outboundBlocked`, `topOutboundBlockedIPs` e `topOutboundBlockedCountries` calculados pela função `analyzeOutboundTraffic` **nunca são incluídos** no objeto `metrics` que vai para o banco. Logo, `m?.topOutboundBlockedCountries` no frontend sempre retorna `undefined` → mapa fica sem dados de saída bloqueada.

**Causa B: `outboundConnections: 0` no snapshot** (os logs de saída permitida também estão vazios)

O snapshot real mostra `outbound_ips: []` e `outboundConnections: 0` — os logs de tráfego permitido estão chegando numa collection que o analisador não está lendo corretamente, ou o blueprint do agente não está enviando `allowed_traffic`. Isso é um problema de coleta no agente, não algo que podemos resolver no frontend.

**Causa C: VPN countries estão corretos, mas FW auth IPs são privados**

O snapshot confirma: IPs de FW auth (`10.13.0.1`, `172.20.10.172`) são endereços privados RFC1918. Eles não resolvem para países, então `topFwAuthCountriesFailed` fica vazio — correto e esperado (acesso administrativo vem da rede interna). Isso não é um bug.

O mapa **deveria** mostrar ao menos as VPN failures (`topVpnAuthCountriesFailed` tem dados: United States, Latvia, Argentina, etc.) e VPN successes (`topAuthCountriesSuccess` tem: Brazil). Isso está chegando, mas pode não estar renderizando se o mapa não tem `firewallLocation` definido (coordenadas do firewall ausentes → `ProjectileOverlay` não é renderizado).

### Problema 2: Tabela "Top IPs Bloqueados" → "Top Tráfego" com duas abas

O usuário quer que a tabela existente "Top IPs Bloqueados (Tráfego Negado)" seja substituída por uma tabela "Top Tráfego" com duas abas:
- **Aba "Saída Permitida"**: exibe `topOutboundIPs` (destinos com conexão bem-sucedida)
- **Aba "Saída Bloqueada"**: exibe `topOutboundBlockedIPs` (destinos bloqueados)

---

## Mudanças necessárias

### Arquivo 1: `supabase/functions/firewall-analyzer/index.ts`

**Adicionar os campos faltantes ao objeto `metrics` salvo** (bug crítico — sem isso, saída bloqueada nunca aparece no mapa ou nas tabelas):

```ts
// Linhas ~1111-1114 — adicionar os 3 campos faltantes:
topOutboundIPs: outboundResult.metrics.topOutboundIPs || [],
topOutboundCountries: outboundResult.metrics.topOutboundCountries || [],
outboundConnections: outboundResult.metrics.outboundConnections || 0,
// ADICIONAR:
outboundBlocked: outboundResult.metrics.outboundBlocked || 0,
topOutboundBlockedIPs: outboundResult.metrics.topOutboundBlockedIPs || [],
topOutboundBlockedCountries: outboundResult.metrics.topOutboundBlockedCountries || [],
```

A edge function precisará ser reimplantada após essa correção.

### Arquivo 2: `src/pages/firewall/AnalyzerDashboardPage.tsx`

**Alterar o card "Top IPs Bloqueados"** para "Top Tráfego" com duas abas:

```tsx
// ANTES: card simples sem abas
<Card className="glass-card">
  <CardHeader>
    <CardTitle>Top IPs Bloqueados (Tráfego Negado)</CardTitle>
  </CardHeader>
  <CardContent>
    <IPListWidget ips={m?.topBlockedIPs ?? []} />
  </CardContent>
</Card>

// DEPOIS: card com abas Saída Permitida / Saída Bloqueada
<Card className="glass-card">
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-base">
      <ExternalLink className="w-4 h-4 text-primary" />
      Top Tráfego
    </CardTitle>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="allowed">
      <TabsList className="mb-3">
        <TabsTrigger value="allowed">Saída Permitida</TabsTrigger>
        <TabsTrigger value="blocked">Saída Bloqueada</TabsTrigger>
      </TabsList>
      <TabsContent value="allowed">
        <IPListWidget ips={m?.topOutboundIPs ?? []} />
      </TabsContent>
      <TabsContent value="blocked">
        <IPListWidget ips={m?.topOutboundBlockedIPs ?? []} />
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

**Remover o card "Top IPs Destino (Saída)"** (linhas 907-919) pois seus dados agora estão na aba "Saída Permitida" do novo card acima — evita duplicação.

**Verificar se `firewallGeo` está sendo resolvido:** Se as coordenadas do firewall não estão sendo carregadas, o `ProjectileOverlay` não é montado e nada aparece no mapa. Adicionar um log de debug temporário ou garantir que `firewallGeo` seja populado.

### Arquivo 3: `src/components/firewall/AttackMapFullscreen.tsx`

**Atualizar o painel de saída** para exibir "Saída Bloqueada" lado a lado com "Saída Permitida", usando `topOutboundBlockedCountries` para o ranking de países bloqueados.

---

## Por que o mapa pode estar ainda sem dados após as correções

O snapshot atual tem `outboundConnections: 0` — os logs de tráfego permitido não estão sendo coletados. Isso é um problema de **blueprint do agente** (a collection `allowed_traffic` não está sendo populada). As VPN failures e successes **devem** aparecer no mapa se o firewall tiver coordenadas geográficas configuradas.

Após reimplantar a edge function e executar uma nova análise, os dados de saída bloqueada aparecerão **se o blueprint enviar a collection `denied_traffic` com logs de action `deny`** originados de IPs privados (tráfego de saída bloqueado pelo firewall).

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Adicionar `outboundBlocked`, `topOutboundBlockedIPs`, `topOutboundBlockedCountries` ao `metrics` final |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Renomear card para "Top Tráfego", adicionar abas "Saída Permitida" / "Saída Bloqueada", remover card duplicado "Top IPs Destino (Saída)" |
| `src/components/firewall/AttackMapFullscreen.tsx` | Ajuste menor no painel de saída para consistência |

Após as mudanças: reimplantar a edge function e executar uma nova análise para confirmar que os dados de saída bloqueada aparecem no banco e no mapa.
