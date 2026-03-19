/**
 * Este arquivo existe apenas para forçar a indexação da pasta python-agent/
 * no sistema de arquivos do Lovable.
 * 
 * NÃO USAR EM PRODUÇÃO - arquivo auxiliar para desenvolvimento.
 * 
 * Para atualizar o agent no servidor, copie os arquivos .py desta pasta.
 */

export const PYTHON_AGENT_FILES = [
  'main.py',
  'requirements.txt',
  'agent/__init__.py',
  'agent/api_client.py',
  'agent/auth.py',
  'agent/config.py',
  'agent/heartbeat.py',
  'agent/logger.py',
  'agent/scheduler.py',
  'agent/state.py',
  'agent/tasks.py',
  'agent/executors/__init__.py',
  'agent/executors/base.py',
  'agent/executors/http_request.py',
  'agent/executors/snmp.py',
  'agent/executors/ssh.py',
  'supervisor/realtime_shell.py',
] as const;
