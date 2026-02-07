"""
Task Executor - Fetches, executes, and reports task results.
Uses generic steps from blueprints instead of hardcoded logic.
Implements progressive streaming: sends each step result immediately after execution.
"""

import time
from typing import Dict, Any, Optional

from agent.executors.http_request import HTTPRequestExecutor
from agent.executors.http_session import HTTPSessionExecutor
from agent.executors.ssh import SSHExecutor
from agent.executors.snmp import SNMPExecutor
from agent.executors.dns_query import DNSQueryExecutor
from agent.executors.amass import AmassExecutor
from agent.executors.powershell import PowerShellExecutor


class TaskExecutor:
    """Orchestrates task execution using generic executors with progressive uploads."""

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
            'dns_query': DNSQueryExecutor(logger),
            'amass': AmassExecutor(logger),
            'powershell': PowerShellExecutor(logger),
        }
        # Feature flag: use progressive streaming if available
        self._use_progressive = True

    def fetch_pending_tasks(self) -> Dict[str, Any]:
        return self.api.get('/agent-tasks')

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute all steps in a task with progressive upload."""
        task_id = task.get('id', 'unknown')
        steps = task.get('steps', [])
        target = task.get('target', {})
        
        self.logger.info(f"Executando tarefa {task_id} com {len(steps)} steps (progressive={self._use_progressive})")
        
        # Track execution time
        start_time = time.time()
        
        context = self._build_context(target)
        step_results = []  # Detailed step-by-step results
        steps_completed = 0
        steps_failed = 0
        errors = []
        
        for i, step in enumerate(steps):
            step_id = step.get('id', 'unknown')
            step_start = time.time()
            
            # Support both 'type' (from blueprint) and 'executor' (legacy) field names
            executor_type = step.get('type') or step.get('executor', 'unknown')
            
            # Auto-route steps with use_session: true to http_session executor
            if step.get('use_session') and executor_type in ('http_request', 'unknown'):
                executor_type = 'http_session'
            
            executor = self._executors.get(executor_type)
            if not executor:
                self.logger.warning(f"Step {step_id}: Executor desconhecido '{executor_type}'")
                step_duration = int((time.time() - step_start) * 1000)
                step_result = {
                    'step_id': step_id,
                    'status': 'failed',
                    'error': f"Executor desconhecido: {executor_type}",
                    'duration_ms': step_duration
                }
                step_results.append(step_result)
                steps_failed += 1
                errors.append(f"{step_id}: Executor desconhecido")
                
                # Report step result progressively
                if self._use_progressive:
                    self._report_step_result(task_id, step_id, 'failed', None, step_result['error'], step_duration)
                continue
            
            try:
                result = executor.run(step, context)
                step_duration = int((time.time() - step_start) * 1000)
                
                # Update context with session data if executor returns it
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
                        steps_failed += 1
                        
                        # Report failed step
                        if self._use_progressive:
                            self._report_step_result(task_id, step_id, 'failed', None, error_msg, step_duration)
                        
                        # Mark all remaining steps as skipped
                        for remaining_step in steps[1:]:
                            remaining_id = remaining_step.get('id', 'unknown')
                            step_results.append({
                                'step_id': remaining_id,
                                'status': 'skipped',
                                'error': 'Ignorado: falha de conectividade no step inicial',
                                'duration_ms': 0
                            })
                            if self._use_progressive:
                                self._report_step_result(task_id, remaining_id, 'skipped', None, 
                                    'Ignorado: falha de conectividade no step inicial', 0)
                        
                        execution_time_ms = int((time.time() - start_time) * 1000)
                        return {
                            'status': 'failed',
                            'error_message': f'Falha de conectividade: {error_msg}',
                            'execution_time_ms': execution_time_ms,
                            'steps_completed': steps_completed,
                            'steps_failed': steps_failed + len(steps) - 1,  # Current + remaining
                            'step_results': step_results
                        }
                
                # Determine step status
                step_status = 'failed' if result.get('error') else 'success'
                step_data = result.get('data') if result.get('data') is not None else None
                step_error = result.get('error') if result.get('error') else None
                
                step_results.append({
                    'step_id': step_id,
                    'status': step_status,
                    'error': step_error,
                    'duration_ms': step_duration
                })
                
                if step_status == 'success':
                    steps_completed += 1
                else:
                    steps_failed += 1
                    errors.append(f"{step_id}: {step_error}")
                
                # Report step result progressively (send data immediately, free memory)
                if self._use_progressive:
                    self._report_step_result(task_id, step_id, step_status, step_data, step_error, step_duration)
                    # Clear data from memory after upload
                    del result
                
            except Exception as e:
                step_duration = int((time.time() - step_start) * 1000)
                error_msg = str(e)
                
                step_results.append({
                    'step_id': step_id,
                    'status': 'failed',
                    'error': error_msg,
                    'duration_ms': step_duration
                })
                steps_failed += 1
                errors.append(f"{step_id}: {error_msg}")
                
                # Report failed step
                if self._use_progressive:
                    self._report_step_result(task_id, step_id, 'failed', None, error_msg, step_duration)
                
                # Also check for connectivity errors in exceptions
                if i == 0 and self._is_connectivity_error(error_msg):
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
                        if self._use_progressive:
                            self._report_step_result(task_id, remaining_id, 'skipped', None,
                                'Ignorado: falha de conectividade no step inicial', 0)
                    
                    execution_time_ms = int((time.time() - start_time) * 1000)
                    return {
                        'status': 'failed',
                        'error_message': f'Falha de conectividade: {error_msg}',
                        'execution_time_ms': execution_time_ms,
                        'steps_completed': steps_completed,
                        'steps_failed': steps_failed + len(steps) - 1,
                        'step_results': step_results
                    }
        
        # Determine final status
        if steps_failed == len(steps) and steps:
            status = 'failed'
        elif steps_failed > 0:
            status = 'partial'  # Some steps failed
        else:
            status = 'completed'
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        self.logger.info(f"Tarefa {task_id} finalizada: status={status}, tempo={execution_time_ms}ms, "
                         f"completed={steps_completed}, failed={steps_failed}")
        
        return {
            'status': status,
            'error_message': '; '.join(errors) if errors else None,
            'execution_time_ms': execution_time_ms,
            'steps_completed': steps_completed,
            'steps_failed': steps_failed,
            'step_results': step_results
        }

    def _report_step_result(self, task_id: str, step_id: str, status: str, 
                            data: Optional[Dict[str, Any]], error: Optional[str], 
                            duration_ms: int) -> None:
        """Send result of a single step to the backend immediately."""
        payload = {
            'task_id': task_id,
            'step_id': step_id,
            'status': status,
            'data': data,
            'error': error,
            'duration_ms': duration_ms
        }
        try:
            response = self.api.post('/agent-step-result', json=payload)
            self.logger.debug(f"Step {step_id} uploaded: {response.get('steps_completed', '?')}/{response.get('steps_total', '?')}")
        except Exception as e:
            # Log but don't fail the task - step result upload is best-effort
            self.logger.warning(f"Falha ao enviar step {step_id}: {str(e)}")

    def _is_connectivity_error(self, error_msg: str) -> bool:
        """Check if an error message indicates a connectivity problem."""
        error_lower = error_msg.lower()
        return any(pattern in error_lower for pattern in self.CONNECTIVITY_PATTERNS)

    def _build_context(self, target: Dict[str, Any]) -> Dict[str, Any]:
        credentials = target.get('credentials', {})
        base_url = target.get('base_url') or target.get('url')
        
        # Extract domain from target or parse from base_url (fallback for DNS steps)
        domain = target.get('domain')
        if not domain and base_url:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(base_url)
                domain = parsed.netloc or parsed.path
                if domain:
                    domain = domain.split('/')[0].split(':')[0]  # Remove port if present
            except Exception:
                pass
        
        return {
            'base_url': base_url,
            'domain': domain,
            'api_key': credentials.get('api_key'),
            'host': target.get('host'),
            'port': target.get('port'),
            'credentials': credentials,
            'username': credentials.get('username'),
            'password': credentials.get('password'),
            'community': credentials.get('community'),
        }

    def report_result(self, task_id: str, result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Report final task completion to the backend."""
        payload = {
            'task_id': task_id,
            'status': result.get('status', 'failed'),
            'error_message': result.get('error_message'),
            'execution_time_ms': result.get('execution_time_ms'),
            # Progressive mode metadata
            'steps_completed': result.get('steps_completed'),
            'steps_failed': result.get('steps_failed'),
        }
        # In progressive mode, we don't send raw data here (it was already sent per step)
        # In legacy mode, we would include result here
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
