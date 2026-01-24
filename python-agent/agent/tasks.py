import time
from typing import Dict, Any, Optional


class TaskExecutor:
    """
    Orquestra a busca e execução de tarefas recebidas do backend.
    """

    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger
        self._executors = {}
        self._load_executors()

    def _load_executors(self):
        """Carrega os executores disponíveis."""
        from agent.executors.fortigate import FortiGateComplianceExecutor, FortiGateCVEExecutor
        from agent.executors.ssh import SSHExecutor
        from agent.executors.snmp import SNMPExecutor

        self._executors = {
            'fortigate_compliance': FortiGateComplianceExecutor(self.logger),
            'fortigate_cve': FortiGateCVEExecutor(self.logger),
            'ssh_command': SSHExecutor(self.logger),
            'snmp_query': SNMPExecutor(self.logger),
        }

    def fetch_pending_tasks(self) -> Dict[str, Any]:
        """Busca tarefas pendentes do backend."""
        try:
            return self.api.get('/agent-tasks')
        except Exception as e:
            self.logger.error(f"Erro ao buscar tarefas: {e}")
            return {'tasks': []}

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executa uma tarefa e retorna o resultado.
        
        Returns:
            Dict com status, result e/ou error_message
        """
        task_type = task.get('type')
        executor = self._executors.get(task_type)

        if not executor:
            self.logger.error(f"Tipo de tarefa desconhecido: {task_type}")
            return {
                'status': 'failed',
                'error_message': f'Tipo de tarefa desconhecido: {task_type}'
            }

        start_time = time.time()

        try:
            result = executor.run(task)
            execution_time_ms = int((time.time() - start_time) * 1000)

            return {
                'status': 'completed',
                'result': result,
                'execution_time_ms': execution_time_ms
            }

        except TimeoutError as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            self.logger.error(f"Timeout ao executar tarefa {task.get('id')}: {e}")
            return {
                'status': 'timeout',
                'error_message': str(e),
                'execution_time_ms': execution_time_ms
            }

        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            self.logger.error(f"Erro ao executar tarefa {task.get('id')}: {e}")
            return {
                'status': 'failed',
                'error_message': str(e),
                'execution_time_ms': execution_time_ms
            }

    def report_result(self, task_id: str, result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Envia resultado da execução para o backend."""
        try:
            payload = {
                'task_id': task_id,
                **result
            }
            return self.api.post('/agent-task-result', json=payload)
        except Exception as e:
            self.logger.error(f"Erro ao reportar resultado da tarefa {task_id}: {e}")
            return None

    def process_all(self) -> int:
        """
        Busca e executa todas as tarefas pendentes.
        
        Returns:
            Número de tarefas processadas
        """
        response = self.fetch_pending_tasks()
        tasks = response.get('tasks', [])

        if not tasks:
            self.logger.debug("Nenhuma tarefa pendente")
            return 0

        self.logger.info(f"Processando {len(tasks)} tarefas")
        processed = 0

        for task in tasks:
            task_id = task.get('id')
            task_type = task.get('type')

            self.logger.info(f"Executando tarefa {task_id}: {task_type}")

            result = self.execute(task)
            self.report_result(task_id, result)

            status = result.get('status')
            if status == 'completed':
                self.logger.info(f"Tarefa {task_id} concluída com sucesso")
            else:
                self.logger.warning(f"Tarefa {task_id} finalizada com status: {status}")

            processed += 1

        return processed
