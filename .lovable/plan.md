

## Ajustar página de Configurações para suportar upload do Supervisor

### Situação atual

A página `src/pages/admin/SettingsPage.tsx` (aba "Agents") tem:
- Upload de um único pacote `.tar.gz` (Agent)
- Grava no bucket como `iscope-agent-{version}.tar.gz` + `iscope-agent-latest.tar.gz`
- Atualiza `agent_latest_version`, `agent_update_checksum`, `agent_force_update` no `system_settings`

O backend (`agent-heartbeat`) já lê as chaves `supervisor_latest_version`, `supervisor_update_checksum` e `supervisor_force_update` do `system_settings`, mas não existe UI para configurá-las.

### Mudanças necessárias

**Arquivo:** `src/pages/admin/SettingsPage.tsx`

1. **Separar o card de upload em dois blocos distintos:**
   - **Publicar Agent** — mantém a lógica atual, mas com label explícito "Pacote do Agent"
   - **Publicar Supervisor** — novo bloco com campos próprios (versão, arquivo, checksum)

2. **Novo estado para o Supervisor:**
   - `supervisorLatestVersion` — lido de `system_settings` key `supervisor_latest_version`
   - `supervisorForceUpdate` — lido de `supervisor_force_update`
   - `selectedSupervisorFile`, `supervisorChecksum`, `newSupervisorVersion`, etc.

3. **Nova função `handlePublishSupervisorUpdate`:**
   - Upload para bucket: `iscope-supervisor-{version}.tar.gz` + `iscope-supervisor-latest.tar.gz`
   - Grava `supervisor_latest_version`, `supervisor_update_checksum`, `supervisor_force_update` no `system_settings`

4. **Carregar settings do Supervisor:**
   - Modificar `loadAgentUpdateSettings()` para também ler `supervisor_latest_version` e `supervisor_force_update`

5. **Status dos Agents:**
   - Adicionar exibição da versão do Supervisor ao lado da versão do Agent (a coluna `supervisor_version` já existe na tabela `agents`)

### Layout proposto

```text
┌─────────────────────────────────────────────────┐
│  Gerenciamento de Atualizações                  │
│  Versão Agent: v1.3.4 | Supervisor: v1.0.0      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─ Publicar Agent ──────────────────────────┐  │
│  │  Versão: [______]  Pacote: [escolher]     │  │
│  │  SHA256: abc123...                         │  │
│  │  ☐ Forçar atualização                     │  │
│  │  [Publicar Agent]                         │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Publicar Supervisor ─────────────────────┐  │
│  │  Versão: [______]  Pacote: [escolher]     │  │
│  │  SHA256: def456...                         │  │
│  │  ☐ Forçar atualização                     │  │
│  │  [Publicar Supervisor]                    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Status dos Agents                              │
│  ✓ 5 atualizados (Agent v1.3.4)               │
│  ⚠ 2 desatualizados                            │
│    • agent-01  Agent v1.3.3  Sup v1.0.0        │
├─────────────────────────────────────────────────┘
```

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/SettingsPage.tsx` | Adicionar estado, UI e lógica de upload para Supervisor; mostrar `supervisor_version` no status |

Nenhuma migração de banco necessária — as chaves `supervisor_latest_version`, `supervisor_update_checksum` e `supervisor_force_update` são criadas via upsert na mesma lógica já usada para o Agent.

