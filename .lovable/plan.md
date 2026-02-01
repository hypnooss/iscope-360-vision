
## Alteração de Terminologia: "Dispositivo" → "Tarefa"

### Objetivo

Substituir todas as referências de "dispositivo" para "tarefa" nas telas de Administração > Coletas, pois a nova terminologia reflete melhor a função do sistema.

---

### Arquivos e Alterações

#### 1. `src/pages/admin/CollectionsPage.tsx`

| Linha | De | Para |
|-------|-----|------|
| 279 | "Gerencie tipos de dispositivos, blueprints..." | "Gerencie as tarefas, blueprints de coleta e regras de compliance" |
| 299 | "Novo Tipo de Dispositivo" | "Nova Tarefa" |
| 310 | "Nenhum tipo de dispositivo cadastrado..." | "Nenhuma tarefa cadastrada para esta categoria." |
| 211 | toast.success('Tipo de dispositivo criado') | toast.success('Tarefa criada') |
| 341 | DialogTitle "Novo Tipo de Dispositivo" | "Nova Tarefa" |
| 354 | Label "Nome do Dispositivo" | "Nome da Tarefa" |

---

#### 2. `src/components/admin/DeviceTypeCard.tsx`

| Linha | De | Para |
|-------|-----|------|
| 162 | toast.success('Tipo de dispositivo atualizado') | toast.success('Tarefa atualizada') |
| 182 | toast.success('Tipo de dispositivo excluído') | toast.success('Tarefa excluída') |
| 311 | DialogTitle "Editar Tipo de Dispositivo" | "Editar Tarefa" |
| 324 | Label "Nome do Dispositivo" | "Nome da Tarefa" |
| 390 | "excluir...também excluirá todos os blueprints..." | Texto ajustado para "tarefa" |

---

#### 3. `src/components/admin/BlueprintsTable.tsx`

| Linha | De | Para |
|-------|-----|------|
| 230 | "...para este tipo de dispositivo." | "...para esta tarefa." |

---

#### 4. `src/components/admin/ComplianceRulesTable.tsx`

| Linha | De | Para |
|-------|-----|------|
| 327 | "...para este tipo de dispositivo." | "...para esta tarefa." |

---

### Observações

- **Não alterar**: Referências a "dispositivo" em contextos não relacionados a Coletas (ex: M365DashboardPage menciona "dispositivos" no contexto de Intune/Defender - isso se refere a dispositivos reais gerenciados)
- **Manter tabela**: O nome da tabela `device_types` permanece inalterado no banco de dados (mudança apenas na UI)

---

### Resumo de Alterações

| Arquivo | Alterações |
|---------|------------|
| `CollectionsPage.tsx` | ~6 textos |
| `DeviceTypeCard.tsx` | ~5 textos |
| `BlueprintsTable.tsx` | 1 texto |
| `ComplianceRulesTable.tsx` | 1 texto |
