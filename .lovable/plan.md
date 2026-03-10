

## Diagnóstico: Execuções do M365 Compliance não aparecem no painel

### Causa raiz

O problema está na função `mapTaskType` em `SchedulesPage.tsx` (linha 196-211). O mapeamento `TASK_TYPE_TO_TARGET` **não inclui** o task_type `m365_powershell`:

```text
TASK_TYPE_TO_TARGET = {
  fortigate_compliance: 'firewall',
  fortigate_analyzer: 'firewall_analyzer',
  external_domain_compliance: 'external_domain',
  m365_compliance: 'm365_compliance',     ← nunca é usado (esse task_type não existe no banco)
  m365_analyzer: 'm365_analyzer',
  attack_surface_scan: 'attack_surface',
}
```

No banco de dados existem **148 tasks** com `task_type: 'm365_powershell'` (criados pelo `trigger-m365-posture-analysis`) e **105** com `m365_analyzer`. Como `m365_powershell` não está no mapeamento, a função cai no fallback `targetType === 'm365_tenant'` → retorna `'m365_analyzer'`.

Resultado: **todas as 148 execuções do M365 Compliance aparecem como M365 Analyzer**, e filtrar por "M365 Compliance" retorna zero resultados.

Nenhuma edge function foi alterada ou corrompida — o fluxo do `trigger-m365-posture-analysis` e do `m365-security-posture` continua intacto. O problema é exclusivamente na UI de mapeamento de tipos.

### Correção

**Arquivo: `src/pages/admin/SchedulesPage.tsx`**

1. Adicionar `m365_powershell: 'm365_compliance'` ao mapeamento `TASK_TYPE_TO_TARGET`
2. No `typeConfig` do `M365ExecutionsPage.tsx`, confirmar que `m365_powershell` já está mapeado para o label "M365 Compliance" (já está nas linhas 112-115)

Alteração única — 1 linha adicionada no mapeamento.

