"""
Task Executor - Fetches, executes, and reports task results.
Uses generic steps from blueprints instead of hardcoded logic.
"""

from typing import Dict, Any, Optional

from agent.executors.http_request import HTTPRequestExecutor
from agent.executors.ssh import SSHExecutor
from agent.executors.snmp import SNMPExecutor


class TaskExecutor:
    """Orchestrates task execution using generic executors."""

    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger
        self._executors = {
            'http_request': HTTPRequestExecutor(logger),
            'ssh_command': SSHExecutor(logger),
            'snmp_query': SNMPExecutor(logger),
        }

    def fetch_pending_tasks(self) -> Dict[str, Any]:
        return self.api.get('/agent-tasks')

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute all steps in a task."""
        task_id = task.get('id', 'unknown')
        steps = task.get('steps', [])
        target = task.get('target', {})
        
        self.logger.info(f"Executando tarefa {task_id} com {len(steps)} steps")
        
        context = self._build_context(target)
        results = {}
        errors = []
        
        for step in steps:
            step_id = step.get('id', 'unknown')
            executor_type = step.get('executor', 'unknown')
            
            executor = self._executors.get(executor_type)
            if not executor:
                results[step_id] = {'error': f"Executor desconhecido: {executor_type}"}
                errors.append(f"{step_id}: Executor desconhecido")
                continue
            
            try:
                result = executor.run(step, context)
                if result.get('error'):
                    errors.append(f"{step_id}: {result['error']}")
                results[step_id] = result.get('data') if result.get('data') is not None else result
            except Exception as e:
                results[step_id] = {'error': str(e)}
                errors.append(f"{step_id}: {str(e)}")
        
        status = 'failed' if len(errors) == len(steps) and steps else 'completed'
        
        return {
            'status': status,
            'result': results,
            'error_message': '; '.join(errors) if errors else None
        }

    def _build_context(self, target: Dict[str, Any]) -> Dict[str, Any]:
        credentials = target.get('credentials', {})
        return {
            'base_url': target.get('base_url') or target.get('url'),
            'api_key': credentials.get('api_key'),
            'host': target.get('host'),
            'port': target.get('port'),
            'credentials': credentials,
            'username': credentials.get('username'),
            'password': credentials.get('password'),
            'community': credentials.get('community'),
        }

    def report_result(self, task_id: str, result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        payload = {
            'task_id': task_id,
            'status': result.get('status', 'failed'),
            'result': result.get('result'),
            'error_message': result.get('error_message'),
        }
        return self.api.post('/agent-task-result', json=payload)

    def process_all(self) -> int:
        response = self.fetch_pending_tasks()
        if not response or not response.get('success'):
            return 0
        
        tasks = response.get('tasks', [])
        if not tasks:
            return 0
        
        self.logger.info(f"Processando {len(tasks)} tarefas")
        processed = 0
        
        for task in tasks:
            task_id = task.get('id')
            try:
                result = self.execute(task)
                self.report_result(task_id, result)
                processed += 1
            except Exception as e:
                self.logger.error(f"Tarefa {task_id}: erro - {str(e)}")
        
        return processed