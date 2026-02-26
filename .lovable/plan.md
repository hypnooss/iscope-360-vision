

## Correção: Contadores de Status dos Supervisors

### Problema

Os contadores mostram "0 atualizados" e "0 desatualizados" quando na realidade existe 1 agente com `supervisor_version = 1.0.0` (ESTRELA-SAO) e 25 agentes sem Supervisor (`supervisor_version = NULL`).

O problema é duplo:
1. Agentes sem Supervisor (NULL) não são contabilizados em nenhuma categoria
2. O total exibido pode confundir — 25 de 26 agentes simplesmente não têm Supervisor

### Plano

**Arquivo:** `src/pages/admin/SettingsPage.tsx`

**Mudança 1 — Ajustar lógica de contagem (linhas ~258-276)**

Filtrar apenas agentes que **têm** `supervisor_version` reportada (ou seja, que rodam o novo modelo). Agentes legados (NULL) devem ser ignorados da contagem, não contados como "atualizados".

```js
// Supervisor stats — only count agents that report supervisor_version
const agentsWithSupervisor = agents.filter((a) => a.supervisor_version);
const supUpToDate = latestSupVer
  ? agentsWithSupervisor.filter((a) => a.supervisor_version === latestSupVer).length
  : agentsWithSupervisor.length;
const supOutdated = latestSupVer
  ? agentsWithSupervisor
      .filter((a) => a.supervisor_version !== latestSupVer)
      .map((a) => ({ ... }))
  : [];

setSupervisorStats({
  total: agentsWithSupervisor.length,  // só agentes com Supervisor
  upToDate: supUpToDate,
  outdated: supOutdated
});
```

**Mudança 2 — Exibir contexto na UI (seção de status, linhas ~960-1000)**

Adicionar indicação de quantos agentes ainda não têm Supervisor instalado:

- Manter os cards "X atualizados" e "Y desatualizados"
- Adicionar texto secundário: "Z agentes sem Supervisor" (em tom neutro/informativo)

Isso dá visibilidade clara: "1 atualizado, 0 desatualizados, 25 sem Supervisor".

### Resultado esperado

Com os dados atuais do banco:
- **1 atualizado** (Sup v1.0.0) — ESTRELA-SAO
- **0 desatualizados**
- **25 sem Supervisor** (texto informativo)

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/SettingsPage.tsx` | Lógica de contagem + UI informativa |

