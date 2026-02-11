

# Exibir Usuarios Ativos M365 no Card de Infraestrutura

## Contexto

A Edge Function `m365-security-posture` ja coleta a contagem de usuarios via Graph API e salva no campo `environment_metrics` da tabela `m365_posture_history`. Os dados ja existem no banco (ex: 1491 ativos de 3120 total).

## Alteracoes

### 1. `src/hooks/useDashboardStats.ts`

- Adicionar um novo campo `m365ActiveUsers` ao tipo `DashboardStats`
- Na secao que ja busca `m365_posture_history`, incluir o campo `environment_metrics` no select
- Para cada tenant (usando o snapshot mais recente ja identificado pelo loop `seen`), extrair `environment_metrics.activeUsers` e somar
- Retornar o total em `stats.m365ActiveUsers`

### 2. `src/pages/GeneralDashboardPage.tsx`

- No grid de Infraestrutura, adicionar um novo bloco para "Usuarios M365" (somente se o modulo M365 estiver ativo para o usuario)
- Icone: `Users` (lucide-react), cor violet-500 (consistente com o card de Infraestrutura)
- Mini-tag: "ATIVOS"
- Valor: `stats.m365ActiveUsers`
- Atualizar o calculo de `infraColCount` para incluir +1 quando o modulo M365 estiver presente

## Resultado visual

O card de Infraestrutura passara a exibir um bloco adicional:

```text
+-------------------+-------------------+-------------------+-------------------+-------------------+
|   Scope Firewall  |   Scope M365      | Scope External    |  Usuarios M365    |     Agents        |
|      TOTAL        |      TOTAL        |     TOTAL         |     ATIVOS        |     ONLINE        |
|        3          |        2          |       5           |      2188         |      2/3          |
+-------------------+-------------------+-------------------+-------------------+-------------------+
```

Nenhuma migracao de banco necessaria. Nenhuma nova dependencia.
