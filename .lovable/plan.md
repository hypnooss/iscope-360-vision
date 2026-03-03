

## Plano: Renomear badges de tipo nas Execuções e Agendamentos

### Alterações de labels

| Página | Chave | Label atual | Novo label |
|--------|-------|-------------|------------|
| **Firewall Execuções** | `fortigate_analysis` | Firewall | Firewall Compliance |
| **Firewall Execuções** | `fortigate_analyzer` | Firewall Analyzer | Firewall Analyzer (sem mudança) |
| **Domínio Externo Execuções** | `api` | API | Domain Compliance |
| **Domínio Externo Execuções** | `attack_surface` | Surface Scanner | Surface Analyzer |
| **Domínio Externo Execuções** | `agent` | Agent | Agent (sem mudança) |
| **M365 Execuções** | `posture_analysis` | API | M365 Compliance |
| **M365 Execuções** | `m365_powershell` | Agent | M365 Analyzer |
| **M365 Execuções** | `m365_graph_api` | Agent | M365 Analyzer |
| **Agendamentos** | `firewall` | Firewall | Firewall Compliance |
| **Agendamentos** | `external_domain` | Domínio Externo | Domain Compliance |
| **Agendamentos** | `attack_surface` | Surface Analyzer | Surface Analyzer (sem mudança) |
| **Agendamentos** | `firewall_analyzer` | Firewall Analyzer | Firewall Analyzer (sem mudança) |
| **Agendamentos** (filtro Select) | `firewall` | Firewall | Firewall Compliance |
| **Agendamentos** (filtro Select) | `external_domain` | Domínio Externo | Domain Compliance |

### Arquivos a editar

1. **`src/pages/firewall/TaskExecutionsPage.tsx`** — Linha 107: `label: 'Firewall'` → `'Firewall Compliance'`
2. **`src/pages/external-domain/ExternalDomainExecutionsPage.tsx`** — Linha 127: `'API'` → `'Domain Compliance'`, linha 137: `'Surface Scanner'` → `'Surface Analyzer'`
3. **`src/pages/m365/M365ExecutionsPage.tsx`** — Linha 105: `'API'` → `'M365 Compliance'`, linhas 110/115: `'Agent'` → `'M365 Analyzer'`
4. **`src/pages/admin/SchedulesPage.tsx`** — `renderTypeBadge`: `'Firewall'` → `'Firewall Compliance'`, `'Domínio Externo'` → `'Domain Compliance'`; filtro Select: mesmas mudanças

### Escopo
Apenas renomeação de labels de texto. Cores, ícones e lógica de filtragem permanecem iguais.

