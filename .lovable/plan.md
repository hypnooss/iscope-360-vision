

# Migrar Edicao de Dominio Externo de Modal para Pagina Dedicada

## Resumo

Transformar o modal `EditExternalDomainDialog` em uma pagina dedicada em `/scope-external-domain/domains/:id/edit`, seguindo o mesmo padrao da pagina `FirewallEditPage`. A nova pagina tera dois cards: Informacoes do Dominio e Agendamento de Analise (com hora, dia da semana e dia do mes).

## Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `src/pages/external-domain/ExternalDomainEditPage.tsx` | Nova pagina de edicao, seguindo a estrutura do `FirewallEditPage` |

## Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `src/App.tsx` | Adicionar rota `/scope-external-domain/domains/:id/edit` |
| `src/pages/external-domain/ExternalDomainListPage.tsx` | Trocar `openEditDialog` para navegar com `navigate`, remover `EditExternalDomainDialog` e estados relacionados (`showEditDialog`, `editingDomain`, `handleEditDomain`) |
| `src/components/external-domain/ExternalDomainTable.tsx` | (Sem alteracao - o `onEdit` ja recebe o dominio, a list page apenas muda o handler) |

## Estrutura da nova pagina

### Card 1 - Informacoes do Dominio
- Workspace (select se super_admin, input disabled caso contrario)
- Dominio (input disabled - nao editavel)
- Agent (select filtrado por workspace)

### Card 2 - Agendamento de Analise
Identico ao `FirewallEditPage`:
- Frequencia (manual / diario / semanal / mensal)
- Horario (select de 00:00 a 23:00) - aparece quando nao e manual
- Dia da semana (select) - aparece quando semanal
- Dia do mes (select 1-28) - aparece quando mensal
- Texto descritivo do agendamento

### Botoes
- Cancelar (volta para lista)
- Salvar (salva dominio + schedule com `next_run_at` calculado)

## Detalhes tecnicos

### Migracao da tabela `external_domain_schedules`

A tabela `external_domain_schedules` atualmente so tem `frequency` e `domain_id`. Para suportar hora/dia da semana/dia do mes, sera necessario adicionar as colunas:
- `scheduled_hour` (integer, default 0)
- `scheduled_day_of_week` (integer, default 1)
- `scheduled_day_of_month` (integer, default 1)

Isso requer uma migracao SQL.

### Logica de save

1. Atualizar `external_domains` (agent_id, client_id se mudou)
2. Deletar schedules existentes para o domain_id
3. Se frequencia != manual, inserir novo schedule com `frequency`, `scheduled_hour`, `scheduled_day_of_week`, `scheduled_day_of_month`, `next_run_at` calculado e `is_active: true`
4. Reutilizar a funcao `calculateNextRunAt` do `FirewallEditPage` (copiar para a nova pagina)

### Fetch de dados

Ao carregar a pagina:
- Buscar `external_domains` pelo id
- Buscar `external_domain_schedules` pelo domain_id (maybeSingle)
- Buscar `clients` e `agents` (filtrados por client_id)
- Preencher o formulario com os dados existentes

