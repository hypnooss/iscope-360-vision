
# Adicionar Modulo Network ao Dashboard

## Problema

O modulo Network (`scope_network`) esta ativo no banco e aparece no menu lateral, mas nao aparece no Dashboard porque:

1. `src/config/moduleDashboardConfig.ts` nao tem uma entrada para `scope_network`
2. `src/hooks/useDashboardStats.ts` nao calcula stats para o modulo Network

## Alteracoes

### 1. `src/config/moduleDashboardConfig.ts`

Adicionar entrada para `scope_network`:

```ts
scope_network: {
  statsKey: 'network',
  path: '/scope-network/dashboard',
  infraLabel: 'Network',
},
```

### 2. `src/hooks/useDashboardStats.ts`

Adicionar uma entrada `network` no Record de modulos com `emptyHealth` (sem tabela de dados especifica ainda):

```ts
setStats({
  modules: {
    firewall: fwHealth,
    m365: m365Health,
    externalDomain: extHealth,
    network: { ...emptyHealth },
  },
  agentsOnline,
  agentsTotal,
});
```

Quando o modulo Network tiver tabelas proprias de assets e historico de analise, a logica de fetch sera adicionada aqui.

## Resultado

O modulo Network aparecera automaticamente como um card no Dashboard (com score "Sem analise" e 0 ativos) e no card Infraestrutura, assim que estiver ativo e o usuario tiver permissao.
