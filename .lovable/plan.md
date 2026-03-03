

## Plano: Botão de Cancelar em Tarefas Pendentes nas Telas de Execução

### Situação Atual

| Página | Agent Tasks | Outros tipos pendentes |
|--------|------------|----------------------|
| Firewall | ✅ Cancela, mas **sem diálogo de confirmação** | N/A |
| Domínio Externo | ✅ Com confirmação | ❌ Análises API (`external_domain_analysis_history`) pendentes não têm botão |
| M365 | ✅ Com confirmação | ❌ Análises Posture (`m365_posture_history`) pendentes não têm botão |

### Alterações

**1. `src/pages/firewall/TaskExecutionsPage.tsx`**
- Adicionar `AlertDialog` de confirmação antes de cancelar (igual ao padrão das outras páginas)
- Adicionar estados `cancelOpen` e `taskToCancel`
- Importar `AlertDialog` components

**2. `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`**
- Adicionar mutation para cancelar análises API pendentes (`external_domain_analysis_history` → `status = 'cancelled'`)
- Exibir botão de cancelar para itens `source === 'analysis'` com status `pending`

**3. `src/pages/m365/M365ExecutionsPage.tsx`**
- Adicionar mutation para cancelar análises Posture pendentes (`m365_posture_history` → `status = 'cancelled'`)
- Exibir botão de cancelar para itens `source === 'posture'` com status `pending`

Em todos os casos, o cancelamento atualiza o `status` para `cancelled` e define `completed_at = now()`.

