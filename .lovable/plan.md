

## Plano: Atualizar pacote do Agent no Storage

### Problema
O `iscope-agent-latest.tar.gz` no bucket `agent-releases` contém o Agent v1.3.13 **sem** o parâmetro `monitor_version` no método `AgentHeartbeat.send()`. O Supervisor passa esse argumento e causa `TypeError`.

### Solução
Re-empacotar o diretório `python-agent/agent/` (que já tem o código correto com `monitor_version`) e fazer upload para o storage via Edge Function temporária `upload-release`.

### Passos
1. Criar tarball `iscope-agent-latest.tar.gz` a partir de `python-agent/agent/`
2. Fazer upload via Edge Function temporária para o bucket `agent-releases`
3. Remover a Edge Function temporária após o upload
4. Usuário re-executa `agent-fix` nos servidores afetados

### Nenhum arquivo do repositório precisa ser alterado
O código fonte já está correto — o problema é apenas o pacote binário no storage.

