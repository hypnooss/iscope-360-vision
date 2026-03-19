

## Adicionar seção Monitor no Gerenciamento de Atualizações

Adicionar uma terceira linha (Monitor Row) no card "Gerenciamento de Atualizações" da aba Agents em `SettingsPage.tsx`, seguindo o mesmo padrão visual das seções Agent e Supervisor.

### Estrutura

O card já tem:
- **Linha 1**: Agent (Publicar + Status) 
- **Linha 2**: Supervisor (Publicar + Status)

Adicionaremos:
- **Linha 3**: Monitor (Publicar + Status)

### Implementação — `src/pages/admin/SettingsPage.tsx`

**1. Novos states** para o Monitor (mesmo padrão do Supervisor):
- `monitorLatestVersion`, `monitorForceUpdate`, `selectedMonitorFile`, `monitorChecksum`, `calculatingMonitorChecksum`, `publishingMonitorUpdate`, `newMonitorVersion`
- `monitorStats` com `{ total, upToDate, outdated[] }`

**2. Carregar settings do Monitor** em `loadAgentUpdateSettings`:
- Ler `monitor_latest_version` e `monitor_force_update` de `system_settings`

**3. Carregar stats do Monitor** em `loadAgentStats`:
- Comparar `monitor_version` (campo já existente em `agent_metrics`) com `monitorLatestVersion`
- Query agents + último `agent_metrics` de cada um para pegar `monitor_version`

**4. Handler `handleMonitorFileSelect`** — calcula SHA256 do arquivo selecionado (mesmo padrão).

**5. Handler `handlePublishMonitorUpdate`**:
- Upload para `agent-releases` como `iscope-monitor-{version}.tar.gz` + `iscope-monitor-latest.tar.gz`
- Upsert em `system_settings`: `monitor_latest_version`, `monitor_update_checksum`, `monitor_force_update`

**6. UI — Nova linha no card**:
- Grid 2 colunas: "Publicar Monitor" (versão, arquivo, checksum, switch force, botão) + "Status dos Monitors" (atualizados/desatualizados)
- Badge `Monitor: v{monitorLatestVersion}` no header do card

**7. Atualizar `CardDescription`** para: "Publique novas versões do Agent, Supervisor e Monitor para atualização automática"

### Ajuste no Supervisor (python-agent)

**8. `python-agent/supervisor/main.py`** — Adicionar lógica de auto-update do Monitor:
- No heartbeat, verificar `monitor_latest_version` vs versão atual do monitor
- Se diferente, baixar `iscope-monitor-latest.tar.gz`, extrair e reiniciar o MonitorWorker

**9. `python-agent/supervisor/config.py`** — Já tem `MONITOR_INTERVAL`, não precisa de mudança.

### Resultado
O card "Gerenciamento de Atualizações" terá 3 seções (Agent, Supervisor, Monitor) com publicação e status independentes. O Supervisor gerencia o update do Monitor automaticamente via heartbeat.

