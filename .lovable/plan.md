

# Adicionar Modulo Cloud e Tornar Stats Dinamico

## Problema

1. O modulo Cloud (`scope_cloud`) existe no banco mas nao tem entrada no `moduleDashboardConfig.ts` nem no hook de stats
2. Cada vez que um modulo novo e criado, e preciso manualmente adicionar uma entrada no `setStats()` -- isso deveria ser automatico

## Alteracoes

### 1. `src/config/moduleDashboardConfig.ts`

Adicionar entrada para `scope_cloud`:

```ts
scope_cloud: {
  statsKey: 'cloud',
  path: '/scope-cloud/dashboard',
  infraLabel: 'Cloud',
},
```

### 2. `src/hooks/useDashboardStats.ts`

Tornar a construcao do objeto `modules` dinamica: importar `MODULE_DASHBOARD_CONFIG` e gerar automaticamente uma entrada `emptyHealth` para todo modulo que nao tenha fetch especifico.

```ts
import { MODULE_DASHBOARD_CONFIG } from '@/config/moduleDashboardConfig';

// Ao final do fetchStats, construir o Record dinamicamente:
const modulesRecord: Record<string, ModuleHealth> = {};

// Modulos com fetch especifico
modulesRecord['firewall'] = fwHealth;
modulesRecord['m365'] = m365Health;
modulesRecord['externalDomain'] = extHealth;

// Preencher todos os outros modulos do config com emptyHealth
for (const config of Object.values(MODULE_DASHBOARD_CONFIG)) {
  if (!modulesRecord[config.statsKey]) {
    modulesRecord[config.statsKey] = { ...emptyHealth };
  }
}

setStats({
  modules: modulesRecord,
  agentsOnline,
  agentsTotal,
});
```

Dessa forma, quando qualquer modulo novo for adicionado ao `MODULE_DASHBOARD_CONFIG`, ele automaticamente aparecera no dashboard com "Sem analise" e 0 ativos, sem precisar tocar no hook.

## Resultado

- Modulo Cloud aparecera no dashboard quando ativado
- Qualquer modulo futuro adicionado ao config sera automaticamente incluido no stats com `emptyHealth`

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/config/moduleDashboardConfig.ts` | Adicionar `scope_cloud` |
| `src/hooks/useDashboardStats.ts` | Construir `modules` dinamicamente a partir do config |

