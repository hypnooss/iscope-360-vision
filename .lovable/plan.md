

# Fix: Implementar scope de Exchange Online (correcao)

As alteracoes do plano anterior nao foram aplicadas ao codigo. Todos os 3 arquivos estao identicos ao original. Vou reimplementar as alteracoes necessarias.

## Problema

1. **Hook** nao envia `scope: 'exchange_online'` -- a API executa todos os 57+ checks
2. **trigger-m365-posture-analysis** nao le `scope` e nao passa `blueprint_filter`
3. **m365-security-posture** nao filtra blueprints nem compliance rules
4. **Agent task** nao inclui scope no payload -- o Agent recebe 0 steps (todos os steps sao filtrados como irrelevantes)

## Alteracoes

### 1. `src/hooks/useExchangeOnlineInsights.ts` (linha 181)

Adicionar `scope: 'exchange_online'` ao body:

```typescript
{ body: { tenant_record_id: tenantRecordId, scope: 'exchange_online' } }
```

### 2. `supabase/functions/trigger-m365-posture-analysis/index.ts`

**Linha 43** - Ler scope do body:
```typescript
const { tenant_record_id, scope } = body;
```

**Linha 134-138** - Incluir scope no payload do Agent task:
```typescript
payload: {
  analysis_id: historyRecord.id,
  tenant_id: tenant.tenant_id,
  tenant_domain: tenant.tenant_domain,
  scope: scope || undefined,
},
```

**Linha 181** - Passar blueprint_filter ao chamar m365-security-posture:
```typescript
body: JSON.stringify({ tenant_record_id, blueprint_filter: scope || undefined }),
```

**Apos linha 199** - Quando scope = exchange_online, tambem chamar `exchange-online-insights` e mesclar resultados nos insights retornados pela analise principal.

### 3. `supabase/functions/m365-security-posture/index.ts`

**Linha 639** - Ler blueprint_filter:
```typescript
const { tenant_record_id, blueprint_filter } = await req.json();
```

**Linha 679-684** - Filtrar blueprints quando blueprint_filter presente:
```typescript
let blueprintQuery = supabase
  .from('device_blueprints')
  .select('*')
  .eq('device_type_id', '5d1a7095-2d7b-4541-873d-4b03c3d6122f')
  .eq('is_active', true)
  .in('executor_type', ['edge_function', 'hybrid']);

if (blueprint_filter === 'exchange_online') {
  blueprintQuery = blueprintQuery.ilike('name', '%Exchange%');
}

const { data: blueprints } = await blueprintQuery;
```

**Linhas 694-698** - Filtrar compliance rules por categorias relevantes:
```typescript
let rulesQuery = supabase
  .from('compliance_rules')
  .select('*')
  .eq('device_type_id', '5d1a7095-2d7b-4541-873d-4b03c3d6122f')
  .eq('is_active', true);

if (blueprint_filter === 'exchange_online') {
  rulesQuery = rulesQuery.in('category', ['email_exchange', 'threats_activity', 'pim_governance']);
}

const { data: rules } = await rulesQuery;
```

### 4. Deploy das Edge Functions

Apos as edicoes, fazer deploy de ambas:
- `trigger-m365-posture-analysis`
- `m365-security-posture`

## Resultado Esperado

- Botao "Reanalisar" no Exchange Online executa apenas o blueprint Exchange
- Agent recebe steps relevantes (nao 0)
- Sem erros 403 em endpoints de PIM, Intune, SharePoint, Teams, etc.

