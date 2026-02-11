

# Corrigir seção de CVEs nos cards do Dashboard

## Problema

A seção de CVEs nos cards de Firewall e M365 está exibindo contagens por severidade como **badges** (usando `SeverityBadgeRow`). O correto é exibir uma **lista com as 2 CVEs de maior pontuação CVSS**, mostrando o ID e o score de cada uma.

## Solução

### 1. Criar hook `useTopCVEs.ts`

Novo hook que reutiliza os dados já disponíveis nos hooks existentes (`useFirewallCVEs` e `useM365CVEs`) para extrair os top 2 CVEs por score CVSS de cada módulo. O hook retorna um objeto `Record<string, TopCVE[]>` mapeando `statsKey` para as CVEs.

```text
Interface TopCVE {
  id: string        // ex: "CVE-2024-21762"
  score: number     // ex: 9.8
  severity: string  // ex: "CRITICAL"
}
```

O hook faz:
- Chama `useFirewallCVEs()` para obter CVEs de firewall (já ordenados por score desc)
- Chama `useM365CVEs()` para obter CVEs de M365
- Retorna os 2 primeiros de cada, mapeados por statsKey ("firewall", "m365")

### 2. Alterar `GeneralDashboardPage.tsx`

Substituir o bloco de badges de CVE (linhas 202-208) por uma lista simples com as 2 CVEs de maior pontuação:

```text
ALERTAS DE CVE
⚠ CVE-2024-21762  CVSS 9.8
⚠ CVE-2024-23113  CVSS 9.1
```

Cada linha mostra:
- Icone `AlertTriangle` pequeno com cor baseada na severidade
- ID da CVE (texto, sem link, sem badge)
- Score CVSS alinhado à direita

Quando não houver CVEs, não exibir a seção (mesmo comportamento atual com `hasCves`).

### 3. Passar `topCves` ao `ModuleHealthCard`

Adicionar prop `topCves?: TopCVE[]` ao componente `ModuleHealthCard`. A página principal busca os dados via `useTopCVEs` e passa para cada card.

## Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `src/hooks/useTopCVEs.ts` | **Criar**: hook que usa `useFirewallCVEs` e `useM365CVEs` para extrair top 2 CVEs por módulo |
| `src/pages/GeneralDashboardPage.tsx` | Importar `useTopCVEs`; adicionar prop `topCves` ao `ModuleHealthCard`; substituir `SeverityBadgeRow` por lista de CVEs com ID + score |

