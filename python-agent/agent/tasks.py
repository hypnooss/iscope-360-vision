"""
Task Executor - Fetches, executes, and reports task results.
Uses generic steps from blueprints instead of hardcoded logic.
Implements progressive streaming: sends each step result immediately after execution.
"""

import time
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from agent.executors.http_request import HTTPRequestExecutor
from agent.executors.http_session import HTTPSessionExecutor
from agent.executors.ssh import SSHExecutor
from agent.executors.snmp import SNMPExecutor
from agent.executors.dns_query import DNSQueryExecutor
from agent.executors.amass import AmassExecutor
from agent.executors.powershell import PowerShellExecutor
from agent.executors.masscan import MasscanExecutor
from agent.executors.nmap import NmapExecutor
from agent.executors.nmap_discovery import NmapDiscoveryExecutor
from agent.executors.httpx_executor import HttpxExecutor
from agent.executors.asn_classifier import AsnClassifierExecutor


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

    # Scanning executors excluded from fail-fast connectivity checks
    # Timeout is expected behavior for these tools (filtered ports, slow targets)
    SCAN_EXECUTORS = {'masscan', 'nmap', 'nmap_discovery', 'httpx', 'asn_classifier'}

    MAX_PARALLEL_TASKS = 4

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
            'masscan': MasscanExecutor(logger),
            'nmap': NmapExecutor(logger),
            'nmap_discovery': NmapDiscoveryExecutor(logger),
            'httpx': HttpxExecutor(logger),
            'asn_classifier': AsnClassifierExecutor(logger),
            'domain_whois': DomainWhoisExecutor(logger),
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
        payload = task.get('payload', {})
        
        self.logger.info(f"Executando tarefa {task_id} com {len(steps)} steps (progressive={self._use_progressive})")
        
        # Track execution time
        start_time = time.time()
        
        context = self._build_context(target)
        
        # Propagate period_start/period_end from task payload to executor context
        # Used by HTTPRequestExecutor for paginated log collection cutoff
        if payload.get('period_start'):
            context['period_start'] = payload['period_start']
        if payload.get('period_end'):
            context['period_end'] = payload['period_end']
        
        # Propagate DNS hostname to context for httpx (proper Host/SNI headers)
        if payload.get('source') == 'dns' and payload.get('label'):
            context['hostname'] = payload['label']
        
        # Handle credential-based auth for M365 RBAC setup
        if payload.get('auth_mode') == 'credential':
            self.logger.info("Using credential-based authentication for this task")
            try:
                encrypted_password = payload.get('password_encrypted')
                transport_key = payload.get('transport_key')
                
                if encrypted_password and transport_key:
                    password = self._decrypt_transport_password(encrypted_password, transport_key)
                    # Inject auth_mode and credentials into step params
                    for step in steps:
                        if step.get('type') == 'powershell':
                            params = step.get('params', {})
                            params['auth_mode'] = 'credential'
                            params['username'] = payload.get('username')
                            params['password'] = password
                            step['params'] = params
                else:
                    return {
                        'status': 'failed',
                        'error_message': 'Missing encrypted password or transport key',
                        'execution_time_ms': 0,
                        'steps_completed': 0,
                        'steps_failed': len(steps),
                        'step_results': []
                    }
            except Exception as e:
                return {
                    'status': 'failed',
                    'error_message': f'Credential decryption failed: {str(e)}',
                    'execution_time_ms': 0,
                    'steps_completed': 0,
                    'steps_failed': len(steps),
                    'step_results': []
                }
        
        step_results = []  # Detailed step-by-step results
        steps_completed = 0
        steps_failed = 0
        errors = []
        
        # Group consecutive PowerShell steps by module for batch execution
        batches = self._group_steps_into_batches(steps)
        
        global_step_index = 0  # Track position for fail-fast on first step
        
        for batch in batches:
            if batch['type'] == 'powershell_batch':
                # Execute all PowerShell steps in a single session
                batch_result = self._execute_powershell_batch(
                    task_id, batch['steps'], context, 
                    is_first=(global_step_index == 0),
                    all_steps=steps
                )
                
                for sr in batch_result['step_results']:
                    step_results.append(sr)
                    if sr['status'] == 'success':
                        steps_completed += 1
                    elif sr['status'] == 'not_applicable':
                        steps_completed += 1  # not_applicable counts as completed
                    elif sr['status'] == 'failed':
                        steps_failed += 1
                        errors.append(f"{sr['step_id']}: {sr.get('error', 'unknown')}")
                    # skipped steps are counted as failed
                    elif sr['status'] == 'skipped':
                        steps_failed += 1
                
                # If batch caused an abort (connectivity failure on first step)
                if batch_result.get('abort'):
                    # Mark all remaining steps (outside this batch) as skipped
                    remaining_steps = steps[global_step_index + len(batch['steps']):]
                    for remaining_step in remaining_steps:
                        remaining_id = remaining_step.get('id', 'unknown')
                        step_results.append({
                            'step_id': remaining_id,
                            'status': 'skipped',
                            'error': 'Ignorado: falha de conectividade no step inicial',
                            'duration_ms': 0
                        })
                        steps_failed += 1
                        if self._use_progressive:
                            self._report_step_result(task_id, remaining_id, 'skipped', None,
                                'Ignorado: falha de conectividade no step inicial', 0)
                    
                    execution_time_ms = int((time.time() - start_time) * 1000)
                    return {
                        'status': 'failed',
                        'error_message': batch_result.get('error_message', 'Falha de conectividade'),
                        'execution_time_ms': execution_time_ms,
                        'steps_completed': steps_completed,
                        'steps_failed': steps_failed,
                        'step_results': step_results
                    }
                
                global_step_index += len(batch['steps'])
            else:
                # Single non-PowerShell step - execute individually
                step = batch['steps'][0]
                i = global_step_index
                step_id = step.get('id', 'unknown')
                step_start = time.time()
                
                executor_type = step.get('type') or step.get('executor', 'unknown')
                
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
                    if self._use_progressive:
                        self._report_step_result(task_id, step_id, 'failed', None, step_result['error'], step_duration)
                    global_step_index += 1
                    continue
                
                try:
                    # Check if http_session step has sub-steps (login/request/logout cycle)
                    config = step.get('config', {})
                    sub_steps = config.get('steps', []) if executor_type == 'http_session' else []
                    
                    if sub_steps:
                        result = self._execute_http_session_substeps(
                            executor, step, sub_steps, config, context
                        )
                    else:
                        result = executor.run(step, context)
                    
                    step_duration = int((time.time() - step_start) * 1000)
                    
                    if result.get('session_data'):
                        context.update(result['session_data'])
                    
                    # Propagar dados do step para o contexto dos steps seguintes
                    # Ex: masscan.data.ports -> context.ports -> nmap usa
                    if result.get('data') and isinstance(result['data'], dict):
                        context.update(result['data'])
                    
                    # Check for connectivity errors on first step (fail-fast)
                    # Scanning executors are excluded - timeout is normal for them
                    if i == 0 and result.get('error'):
                        error_msg = result.get('error', '')
                        if executor_type not in self.SCAN_EXECUTORS and self._is_connectivity_error(error_msg):
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
                            if self._use_progressive:
                                self._report_step_result(task_id, step_id, 'failed', None, error_msg, step_duration)
                            
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
                    
                    step_data = result.get('data') if result.get('data') is not None else None
                    step_error = result.get('error') if result.get('error') else None
                    
                    # Pre-filter config_changes: keep only logs with cfgpath (real config changes)
                    # This must happen BEFORE truncation in _report_step_result
                    if step_id == 'config_changes' and step_data and isinstance(step_data, dict):
                        results_list = step_data.get('results', [])
                        if isinstance(results_list, list) and results_list:
                            original_count = len(results_list)
                            filtered = [log for log in results_list if isinstance(log, dict) and log.get('cfgpath')]
                            step_data = dict(step_data)
                            step_data['results'] = filtered
                            step_data['_pre_filtered'] = True
                            step_data['_pre_filter_original'] = original_count
                            self.logger.info(
                                f"Step {step_id}: Pre-filtered config_changes: "
                                f"{original_count} -> {len(filtered)} (kept only cfgpath logs)"
                            )
                    
                    # Support optional steps - failures become not_applicable
                    is_optional = step.get('config', {}).get('optional', False)
                    if result.get('error') and is_optional:
                        step_status = 'not_applicable'
                        step_error = f"[optional] {result.get('error')}"
                    elif result.get('error'):
                        step_status = 'failed'
                    else:
                        step_status = 'success'
                    
                    step_results.append({
                        'step_id': step_id,
                        'status': step_status,
                        'error': step_error,
                        'duration_ms': step_duration
                    })
                    
                    if step_status == 'success':
                        steps_completed += 1
                    elif step_status == 'not_applicable':
                        pass  # Don't count optional failures
                    else:
                        steps_failed += 1
                        errors.append(f"{step_id}: {step_error}")
                    
                    if self._use_progressive:
                        self._report_step_result(task_id, step_id, step_status, step_data, step_error, step_duration)
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
                    
                    if self._use_progressive:
                        self._report_step_result(task_id, step_id, 'failed', None, error_msg, step_duration)
                    
                    if i == 0 and executor_type not in self.SCAN_EXECUTORS and self._is_connectivity_error(error_msg):
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
                
                global_step_index += 1
        
        # Determine final status
        # Count not_applicable steps separately - they don't count as failures
        steps_na = sum(1 for sr in step_results if sr['status'] == 'not_applicable')
        actual_failures = steps_failed  # not_applicable already excluded from steps_failed
        
        if actual_failures == len(steps) and steps:
            status = 'failed'
        elif actual_failures > 0:
            status = 'partial'  # Some steps failed
        else:
            status = 'completed'  # All success or not_applicable
        
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

    def _group_steps_into_batches(self, steps):
        """
        Group consecutive PowerShell steps with the same module into batches.
        Non-PowerShell steps become single-step batches.
        """
        batches = []
        current_ps_batch = None
        
        for step in steps:
            executor_type = step.get('type') or step.get('executor', 'unknown')
            
            if executor_type == 'powershell':
                module = step.get('params', {}).get('module', 'ExchangeOnline')
                
                if current_ps_batch and current_ps_batch['module'] == module:
                    current_ps_batch['steps'].append(step)
                else:
                    if current_ps_batch:
                        batches.append(current_ps_batch)
                    current_ps_batch = {
                        'type': 'powershell_batch',
                        'module': module,
                        'steps': [step]
                    }
            else:
                if current_ps_batch:
                    batches.append(current_ps_batch)
                    current_ps_batch = None
                batches.append({
                    'type': 'single',
                    'steps': [step]
                })
        
        if current_ps_batch:
            batches.append(current_ps_batch)
        
        return batches
    
    def _execute_powershell_batch(self, task_id, steps, context, is_first=False, all_steps=None):
        """
        Execute multiple PowerShell steps in a single session.
        Uses interactive (progressive) mode: opens one session, executes commands
        one by one, and reports each result immediately via _report_step_result.
        Falls back to legacy batch mode for single-command tasks.
        
        Returns dict with 'step_results' list and optional 'abort' flag.
        """
        executor = self._executors.get('powershell')
        
        # Use interactive mode for multi-step batches
        if len(steps) > 1 and hasattr(executor, 'run_interactive'):
            return self._execute_powershell_interactive(task_id, steps, context, executor, is_first)
        
        # Legacy batch mode (single command or fallback)
        return self._execute_powershell_batch_legacy(task_id, steps, context, executor, is_first)
    
    def _execute_powershell_interactive(self, task_id, steps, context, executor, is_first=False):
        """Execute PowerShell steps progressively using interactive session."""
        batch_start = time.time()
        
        module = steps[0].get('params', {}).get('module', 'unknown')
        self.logger.info(
            f"PowerShell interactive batch: module={module}, {len(steps)} steps"
        )
        
        def report_callback(step_id, status, data, error, duration_ms):
            """Callback invoked by executor for each completed command."""
            if self._use_progressive:
                self._report_step_result(task_id, step_id, status, data, error, duration_ms)
        
        try:
            step_results = executor.run_interactive(steps, context, report_callback)
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"PowerShell interactive batch error: {error_msg}")
            
            step_results = []
            for step in steps:
                step_id = step.get('id', 'unknown')
                step_results.append({
                    'step_id': step_id,
                    'status': 'failed',
                    'error': error_msg,
                    'duration_ms': 0
                })
                if self._use_progressive:
                    self._report_step_result(task_id, step_id, 'failed', None, error_msg, 0)
            
            return {
                'step_results': step_results,
                'abort': is_first and self._is_connectivity_error(error_msg),
                'error_message': f'Falha de conectividade: {error_msg}' if is_first else None
            }
        
        batch_duration = int((time.time() - batch_start) * 1000)
        self.logger.info(
            f"PowerShell interactive batch completed: {len(step_results)} results in {batch_duration}ms"
        )
        
        # Check if first step failed with connectivity error (fail-fast)
        if is_first and step_results and step_results[0].get('status') == 'failed':
            first_error = step_results[0].get('error', '')
            if self._is_connectivity_error(first_error):
                return {
                    'step_results': step_results,
                    'abort': True,
                    'error_message': f'Falha de conectividade: {first_error}'
                }
        
        return {'step_results': step_results}
    
    def _execute_powershell_batch_legacy(self, task_id, steps, context, executor, is_first=False):
        """Legacy batch execution: all commands in a single script."""
        batch_start = time.time()
        
        first_params = dict(steps[0].get('params', {}))
        merged_commands = []
        batch_timeouts = []
        for step in steps:
            step_params = step.get('params', {})
            cmds = step_params.get('commands', [])
            merged_commands.extend(cmds)
            timeout_value = step_params.get('timeout')
            if isinstance(timeout_value, (int, float)) and timeout_value > 0:
                batch_timeouts.append(int(timeout_value))

        default_batch_timeout = 300 + (max(0, len(merged_commands) - 1) * 30)
        computed_batch_timeout = max([default_batch_timeout, *batch_timeouts]) if batch_timeouts else default_batch_timeout

        first_params['commands'] = merged_commands
        first_params['timeout'] = computed_batch_timeout
        merged_step = {'type': 'powershell', 'params': first_params}
        
        module = first_params.get('module', 'unknown')
        self.logger.info(
            f"PowerShell legacy batch: module={module}, {len(steps)} steps, "
            f"{len(merged_commands)} commands, computed_timeout={computed_batch_timeout}s "
            f"(default={default_batch_timeout}s, step_timeouts={batch_timeouts})"
        )
        
        try:
            result = executor.run(merged_step, context)
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"PowerShell batch execution error: {error_msg}")
            
            step_results = []
            for step in steps:
                step_id = step.get('id', 'unknown')
                step_results.append({
                    'step_id': step_id,
                    'status': 'failed',
                    'error': error_msg,
                    'duration_ms': 0
                })
                if self._use_progressive:
                    self._report_step_result(task_id, step_id, 'failed', None, error_msg, 0)
            
            return {
                'step_results': step_results,
                'abort': is_first and self._is_connectivity_error(error_msg),
                'error_message': f'Falha de conectividade: {error_msg}' if is_first else None
            }
        
        batch_duration = int((time.time() - batch_start) * 1000)
        per_step_duration = batch_duration // max(len(steps), 1)
        
        if result.get('error'):
            error_msg = result['error']
            self.logger.error(
                f"PowerShell batch failed: module={first_params.get('module', 'unknown')}, "
                f"commands={len(merged_commands)}, timeout={computed_batch_timeout}s, error={error_msg}"
            )
            
            step_results = []
            for step in steps:
                step_id = step.get('id', 'unknown')
                step_results.append({
                    'step_id': step_id,
                    'status': 'failed',
                    'error': error_msg,
                    'duration_ms': per_step_duration
                })
                if self._use_progressive:
                    self._report_step_result(task_id, step_id, 'failed', None, error_msg, per_step_duration)
            
            return {
                'step_results': step_results,
                'abort': is_first and self._is_connectivity_error(error_msg),
                'error_message': f'Falha de conectividade: {error_msg}' if is_first else None
            }
        
        if result.get('raw'):
            error_msg = f"PowerShell output is not valid JSON: {str(result.get('data', ''))[:200]}"
            self.logger.error(f"PowerShell batch raw output: {error_msg}")
            
            step_results = []
            for step in steps:
                step_id = step.get('id', 'unknown')
                step_results.append({
                    'step_id': step_id,
                    'status': 'failed',
                    'error': error_msg,
                    'duration_ms': per_step_duration
                })
                if self._use_progressive:
                    self._report_step_result(task_id, step_id, 'failed', None, error_msg, per_step_duration)
            
            return {
                'step_results': step_results,
                'abort': False,
            }
        
        data = result.get('data', {})
        step_results = []
        
        for step in steps:
            step_id = step.get('id', 'unknown')
            cmds = step.get('params', {}).get('commands', [])
            cmd_name = cmds[0]['name'] if cmds else 'unknown'
            
            if isinstance(data, dict) and cmd_name in data:
                cmd_result = data[cmd_name]
                
                if isinstance(cmd_result, dict):
                    if cmd_result.get('success') is False:
                        error_text = cmd_result.get('error', 'Command failed')
                        if 'is not recognized as a name of a cmdlet' in error_text:
                            step_status = 'not_applicable'
                            step_error = f"Cmdlet nao disponivel (licenca ausente): {error_text[:150]}"
                        else:
                            step_status = 'failed'
                            step_error = error_text
                        step_data = None
                    else:
                        step_status = 'success'
                        step_error = None
                        raw_data = cmd_result.get('data')
                        if isinstance(raw_data, str):
                            import json
                            try:
                                step_data = json.loads(raw_data)
                            except (json.JSONDecodeError, ValueError):
                                step_data = raw_data
                        else:
                            step_data = raw_data
                else:
                    step_status = 'success'
                    step_error = None
                    step_data = cmd_result
            else:
                step_status = 'failed'
                step_error = f"No result found for command '{cmd_name}'"
                step_data = None
            
            step_results.append({
                'step_id': step_id,
                'status': step_status,
                'error': step_error,
                'duration_ms': per_step_duration
            })
            
            if self._use_progressive:
                self._report_step_result(task_id, step_id, step_status, step_data, step_error, per_step_duration)
        
        del result
        
        return {'step_results': step_results}

    # Maximum number of records to send per step to avoid DB statement timeout
    MAX_STEP_RECORDS = 1500

    def _report_step_result(self, task_id: str, step_id: str, status: str, 
                            data: Optional[Dict[str, Any]], error: Optional[str], 
                            duration_ms: int) -> None:
        """Send result of a single step to the backend immediately.
        
        Truncates large result sets to MAX_STEP_RECORDS to prevent DB timeouts,
        adding metadata about the original count.
        """
        # Truncate large result sets to prevent DB statement timeout
        if data and isinstance(data, dict) and 'results' in data:
            results = data['results']
            if isinstance(results, list) and len(results) > self.MAX_STEP_RECORDS:
                original_count = len(results)
                data = dict(data)  # shallow copy to avoid mutating original
                data['results'] = results[:self.MAX_STEP_RECORDS]
                data['_truncated'] = True
                data['_original_count'] = original_count
                self.logger.info(
                    f"Step {step_id}: Truncated results from {original_count} "
                    f"to {self.MAX_STEP_RECORDS} records for upload"
                )

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

    def _execute_http_session_substeps(self, executor, step, sub_steps, config, context):
        """
        Execute http_session sub-steps (login -> request -> logout) sequentially.
        
        Each blueprint step for SonicWall contains config.steps with sub-steps like:
          [0] auth_login  (POST /api/sonicos/auth)
          [1] request     (GET /api/sonicos/version)
          [2] auth_logout (DELETE /api/sonicos/auth)
        
        Returns the result of the 'request' sub-step as the step's result.
        """
        step_id = step.get('id', 'unknown')
        request_result = None
        
        # Shared config from parent step
        parent_headers = config.get('headers', {})
        verify_ssl = config.get('verify_ssl', False)
        timeout = config.get('timeout', 30)
        
        for sub_step in sub_steps:
            sub_id = sub_step.get('id', '')
            
            # Determine action from sub-step id
            if 'auth_login' in sub_id or sub_id == 'login':
                action = 'login'
            elif 'auth_logout' in sub_id or sub_id == 'logout':
                action = 'logout'
            else:
                action = 'request'
            
            # Merge headers: parent config headers + sub-step specific headers
            merged_headers = dict(parent_headers)
            if sub_step.get('headers'):
                merged_headers.update(sub_step['headers'])
            
            # Build synthetic step for the executor
            synthetic_step = {
                'id': sub_id,
                'action': action,
                'method': sub_step.get('method', 'GET'),
                'path': sub_step.get('path', '/'),
                'headers': merged_headers,
                'body': sub_step.get('body'),
                'verify_ssl': verify_ssl,
                'timeout': timeout,
            }
            
            self.logger.debug(f"Step {step_id}: sub-step '{sub_id}' action={action}")
            
            try:
                result = executor.run(synthetic_step, context)
            except Exception as e:
                self.logger.error(f"Step {step_id}: sub-step '{sub_id}' exception: {e}")
                if action == 'logout':
                    # Logout failure is non-fatal
                    self.logger.warning(f"Step {step_id}: logout failed but data was already collected")
                    continue
                return {
                    'status_code': 0,
                    'data': None,
                    'error': f"Sub-step '{sub_id}' failed: {str(e)}"
                }
            
            # Propagate session data into context
            if result.get('session_data'):
                context.update(result['session_data'])
            
            if action == 'login':
                if result.get('error'):
                    self.logger.error(f"Step {step_id}: login failed, aborting remaining sub-steps")
                    return result  # Propagate login error as the step result
                    
            elif action == 'request':
                request_result = result
                # Don't abort on request error — still try logout
                
            elif action == 'logout':
                if result.get('error'):
                    self.logger.warning(f"Step {step_id}: logout returned error (non-fatal): {result['error']}")
                # Clean session keys from context after logout
                context.pop('_session_key', None)
                context.pop('_session_active', None)
        
        # Return the request result (the actual data), or error if no request was executed
        if request_result is not None:
            return request_result
        
        return {
            'status_code': 0,
            'data': None,
            'error': f"Step {step_id}: no request sub-step found in config.steps"
        }

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
        
        context = {
            'base_url': base_url,
            'domain': domain,
            'ip': target.get('ip'),
            'api_key': credentials.get('api_key'),
            'host': target.get('host'),
            'port': target.get('port'),
            'credentials': credentials,
            'username': credentials.get('username'),
            'password': credentials.get('password'),
            'community': credentials.get('community'),
        }
        
        # M365 specific context
        if target.get('type') == 'm365_tenant':
            context.update({
                'app_id': credentials.get('azure_app_id'),
                'tenant_id': target.get('tenant_id'),
                'organization': target.get('tenant_domain'),
                'certificate_thumbprint': credentials.get('certificate_thumbprint'),
            })
        
        return context
    
    def _decrypt_transport_password(self, encrypted: str, key: str) -> str:
        """Decrypt password that was XOR-encrypted for transport."""
        import base64
        try:
            encrypted_bytes = base64.b64decode(encrypted)
            key_bytes = key.encode('utf-8')
            result_bytes = bytearray(len(encrypted_bytes))
            
            for i in range(len(encrypted_bytes)):
                result_bytes[i] = encrypted_bytes[i] ^ key_bytes[i % len(key_bytes)]
            
            return result_bytes.decode('utf-8')
        except Exception as e:
            self.logger.error(f"Failed to decrypt transport password: {e}")
            raise ValueError("Failed to decrypt credentials")

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

    def _execute_and_report(self, task: Dict[str, Any]) -> bool:
        """Execute a single task and report its result. Returns True on success."""
        task_id = task.get('id')
        try:
            result = self.execute(task)
            self.report_result(task_id, result)
            return True
        except Exception as e:
            self.logger.error(f"Tarefa {task_id}: erro - {str(e)}")
            return False

    def process_all(self) -> int:
        response = self.fetch_pending_tasks()
        if not response or not response.get('success'):
            return 0

        tasks = response.get('tasks', [])
        if not tasks:
            return 0

        self.logger.info(f"Processando {len(tasks)} tarefas (max_parallel={self.MAX_PARALLEL_TASKS})")

        if len(tasks) == 1:
            return 1 if self._execute_and_report(tasks[0]) else 0

        processed = 0
        with ThreadPoolExecutor(max_workers=self.MAX_PARALLEL_TASKS) as pool:
            futures = {
                pool.submit(self._execute_and_report, task): task.get('id')
                for task in tasks
            }
            for future in as_completed(futures):
                task_id = futures[future]
                try:
                    if future.result():
                        processed += 1
                except Exception as e:
                    self.logger.error(f"Tarefa {task_id}: erro nao capturado - {e}")

        self.logger.info(f"Lote finalizado: {processed}/{len(tasks)} tarefas concluidas")
        return processed
