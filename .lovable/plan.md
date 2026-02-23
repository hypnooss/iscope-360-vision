

# Exibir Top CVEs nos Cards de Firewall e Dominio Externo

## Problema

1. **Firewall**: O card do Firewall no Dashboard nao exibe as top CVEs, apesar de ter o botao "CVEs". O problema esta no lookup: o hook `useTopCVEs` retorna dados indexados por `module_code` da tabela `cve_severity_cache`, mas o dashboard usa `statsKey` para buscar. Para firewall ambos sao `'firewall'`, entao o problema pode ser que os registros na tabela `cve_severity_cache` para firewall tem `client_id` definido e o filtro no hook nao esta retornando corretamente, ou o campo `top_cves` esta vazio para esses registros.

2. **Dominio Externo**: O card nao exibe CVEs porque: (a) o `statsKey` e `'externalDomain'` mas o `module_code` na tabela e `'external_domain'` -- nao batem; (b) nao tem `cvePath` configurado, entao o botao de CVEs nem aparece.

## Solucao

### 1. Corrigir mapeamento de module_code para statsKey no `useTopCVEs`

Alterar o hook `src/hooks/useTopCVEs.ts` para mapear os `module_code` do banco para os `statsKey` usados no dashboard, garantindo compatibilidade:

- `firewall` -> `firewall` (ja correto)
- `m365` -> `m365` (ja correto)
- `external_domain` -> `externalDomain` (precisa mapeamento)

### 2. Adicionar CVE path para Dominio Externo no config

Atualizar `src/config/moduleDashboardConfig.ts` para incluir `cvePath` no modulo `scope_external_domain`, apontando para a pagina do Surface Analyzer (ou uma pagina dedicada de CVEs, se existir).

### Secao Tecnica

**Arquivo: `src/hooks/useTopCVEs.ts`**
- Adicionar um mapa de conversao `MODULE_CODE_TO_STATS_KEY` com `{ external_domain: 'externalDomain' }`.
- No loop que processa os dados, usar o mapa para converter a chave antes de inserir no resultado.

**Arquivo: `src/config/moduleDashboardConfig.ts`**
- Adicionar `cvePath: '/scope-external-domain/analyzer'` ao bloco `scope_external_domain` para que o botao "CVEs" apareca no card.

**Arquivo: `src/pages/GeneralDashboardPage.tsx`**
- Nenhuma alteracao necessaria; o card ja renderiza `topCves` e o botao de CVEs quando `cvePath` existe.

