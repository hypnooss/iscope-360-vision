"""
Task Executor - Fetches, executes, and reports task results.
Uses generic steps from blueprints instead of hardcoded logic.
"""

import time
from typing import Dict, Any, Optional

from agent.executors.http_request import HTTPRequestExecutor
from agent.executors.http_session import HTTPSessionExecutor
from agent.executors.ssh import SSHExecutor
from agent.executors.snmp import SNMPExecutor


class TaskExecutor:
    """Orchestrates task execution using generic executors."""

    # Patterns that indicate connectivity problems
    CONNECTIVITY_PATTERNS = [
        'timeout',
        'connection error',
        'connection refused',
        'no route to host',
        'network unreachable',
        'name or service not known',
        'failed to resolve',
        'connection reset',
        'connection timed out',
        'errno 110',  # Connection timed out
        'errno 111',  # Connection refused
        'errno 113',  # No route to host
    ]

    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger
        self._executors = {
            'http_request': HTTPRequestExecutor(logger),
            'http_session': HTTPSessionExecutor(logger),
            'ssh_command': SSHExecutor(logger),
            'snmp_query': SNMPExecutor(logger),
        }

    def fetch_pending_tasks(self) -> Dict[str, Any]:
        return self.api.get('/agent-tasks')

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute all steps in a task with fail-fast on connectivity errors."""
        task_id = task.get('id', 'unknown')
        steps = task.get('steps', [])
        target = task.get('target', {})
        
        self.logger.info(f"Executando tarefa {task_id} com {len(steps)} steps")
        
        # Track execution time
        start_time = time.time()
        
        context = self._build_context(target)
        results = {}
        step_results = []  # Detailed step-by-step results
        errors = []
        
        for i, step in enumerate(steps):
            step_id = step.get('id', 'unknown')
            step_start = time.time()
            
            # Support both 'type' (from blueprint) and 'executor' (legacy) field names
            executor_type = step.get('type') or step.get('executor', 'unknown')
            
            # Auto-route steps with use_session: true to http_session executor
            # This allows session sharing between login/request/logout steps
            if step.get('use_session') and executor_type in ('http_request', 'unknown'):
                executor_type = 'http_session'
            
            executor = self._executors.get(executor_type)
            if not executor:
                self.logger.warning(f"Step {step_id}: Executor desconhecido '{executor_type}'")
                step_result = {
                    'step_id': step_id,
                    'status': 'error',
                    'error': f"Executor desconhecido: {executor_type}",
                    'duration_ms': int((time.time() - step_start) * 1000)
                }
                step_results.append(step_result)
                results[step_id] = {'error': f"Executor desconhecido: {executor_type}"}
                errors.append(f"{step_id}: Executor desconhecido")
                continue
            
            try:
                result = executor.run(step, context)
                step_duration = int((time.time() - step_start) * 1000)
                
                # Update context with session data if executor returns it
                # This allows session-based executors to pass cookies/tokens between steps
                if result.get('session_data'):
                    context.update(result['session_data'])
                
                # Check for connectivity errors on first step (fail-fast)
                if i == 0 and result.get('error'):
                    error_msg = result.get('error', '')
                    if self._is_connectivity_error(error_msg):
                        self.logger.error(
                            f"Falha de conectividade no primeiro step. "
                            f"Abortando {len(steps) - 1} steps restantes."
                        )
                        step_results.append({
                            'step_id': step_id,
                            'status': 'failed',
                            'error': error_msg,
                            'duration_ms': step_duration
                        })
                        results[step_id] = result
                        # Mark all remaining steps as skipped
                        for remaining_step in steps[1:]:
                            remaining_id = remaining_step.get('id', 'unknown')
                            step_results.append({
                                'step_id': remaining_id,
                                'status': 'skipped',
                                'error': 'Ignorado: falha de conectividade no step inicial',
                                'duration_ms': 0
                            })
                            results[remaining_id] = {
                                'error': 'Ignorado: falha de conectividade no step inicial',
                                'skipped': True
                            }
                        
                        execution_time_ms = int((time.time() - start_time) * 1000)
                        return {
                            'status': 'failed',
                            'result': results,
                            'error_message': f'Falha de conectividade: {error_msg}',
                            'execution_time_ms': execution_time_ms,
                            'step_results': step_results
                        }
                
                # Record step result
                step_status = 'error' if result.get('error') else 'success'
                step_results.append({
                    'step_id': step_id,
                    'status': step_status,
                    'error': result.get('error') if result.get('error') else None,
                    'duration_ms': step_duration
                })
                
                if result.get('error'):
                    errors.append(f"{step_id}: {result['error']}")
                results[step_id] = result.get('data') if result.get('data') is not None else result
                
            except Exception as e:
                step_duration = int((time.time() - step_start) * 1000)
                step_results.append({
                    'step_id': step_id,
                    'status': 'error',
                    'error': str(e),
                    'duration_ms': step_duration
                })
                results[step_id] = {'error': str(e)}
                errors.append(f"{step_id}: {str(e)}")
                
                # Also check for connectivity errors in exceptions
                if i == 0 and self._is_connectivity_error(str(e)):
                    self.logger.error(
                        f"Falha de conectividade no primeiro step (exceção). "
                        f"Abortando {len(steps) - 1} steps restantes."
                    )
                    for remaining_step in steps[1:]:
                        remaining_id = remaining_step.get('id', 'unknown')
                        step_results.append({
                            'step_id': remaining_id,
                            'status': 'skipped',
                            'error': 'Ignorado: falha de conectividade no step inicial',
                            'duration_ms': 0
                        })
                        results[remaining_id] = {
                            'error': 'Ignorado: falha de conectividade no step inicial',
                            'skipped': True
                        }
                    
                    execution_time_ms = int((time.time() - start_time) * 1000)
                    return {
                        'status': 'failed',
                        'result': results,
                        'error_message': f'Falha de conectividade: {str(e)}',
                        'execution_time_ms': execution_time_ms,
                        'step_results': step_results
                    }
        
        status = 'failed' if len(errors) == len(steps) and steps else 'completed'
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        self.logger.info(f"Tarefa {task_id} finalizada: status={status}, tempo={execution_time_ms}ms")
        
        return {
            'status': status,
            'result': results,
            'error_message': '; '.join(errors) if errors else None,
            'execution_time_ms': execution_time_ms,
            'step_results': step_results
        }

    def _is_connectivity_error(self, error_msg: str) -> bool:
        """Check if an error message indicates a connectivity problem."""
        error_lower = error_msg.lower()
        return any(pattern in error_lower for pattern in self.CONNECTIVITY_PATTERNS)

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
            'execution_time_ms': result.get('execution_time_ms'),
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
