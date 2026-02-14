

# Multi-Task: Execucao Paralela de Tarefas Independentes

## Situacao Atual

O metodo `process_all()` em `tasks.py` (linha 765) itera sequencialmente:

```text
Tarefa 1 (firewall A) -> executa todos os steps -> reporta
Tarefa 2 (firewall B) -> executa todos os steps -> reporta
Tarefa 3 (IP scan)    -> executa todos os steps -> reporta
...
```

Se o Agent recebe 10 tarefas de attack surface (cada uma para um IP diferente), ele executa uma por vez. Cada tarefa pode levar 2-5 minutos (masscan + nmap + httpx), totalizando 20-50 minutos sequenciais.

## Proposta

Transformar `process_all()` para executar tarefas independentes em paralelo usando `ThreadPoolExecutor`, mantendo a execucao sequencial dos steps **dentro** de cada tarefa (que ja possuem dependencia: masscan -> nmap -> httpx).

```text
Thread 1: Tarefa 1 (IP-A) -> masscan -> nmap -> httpx -> reporta
Thread 2: Tarefa 2 (IP-B) -> masscan -> nmap -> httpx -> reporta
Thread 3: Tarefa 3 (FW-A) -> step1 -> step2 -> ... -> reporta
Thread 4: Tarefa 4 (IP-C) -> masscan -> nmap -> httpx -> reporta
```

## Regras de Paralelismo

- **Max workers**: 4 threads simultaneas (configuravel, conservador para nao sobrecarregar a maquina)
- **Dentro de cada tarefa**: execucao continua sequencial (steps tem dependencia)
- **Entre tarefas diferentes**: execucao paralela
- **Executors sao thread-safe**: cada executor instancia seu proprio subprocess (nmap, masscan, httpx), sem estado compartilhado

## Alteracoes

**Arquivo:** `python-agent/agent/tasks.py`

### 1. Import do ThreadPoolExecutor
Adicionar `from concurrent.futures import ThreadPoolExecutor, as_completed` no topo do arquivo.

### 2. Constante MAX_PARALLEL_TASKS
Adicionar `MAX_PARALLEL_TASKS = 4` como atributo da classe `TaskExecutor`.

### 3. Novo metodo `_execute_and_report`
Encapsula a logica de executar + reportar uma unica tarefa, retornando True/False para contagem:

```python
def _execute_and_report(self, task: Dict[str, Any]) -> bool:
    task_id = task.get('id')
    try:
        result = self.execute(task)
        self.report_result(task_id, result)
        return True
    except Exception as e:
        self.logger.error(f"Tarefa {task_id}: erro - {str(e)}")
        return False
```

### 4. Reescrever `process_all`
Substituir o loop sequencial por execucao paralela:

```python
def process_all(self) -> int:
    response = self.fetch_pending_tasks()
    if not response or not response.get('success'):
        return 0

    tasks = response.get('tasks', [])
    if not tasks:
        return 0

    self.logger.info(f"Processando {len(tasks)} tarefas (max_parallel={self.MAX_PARALLEL_TASKS})")
    
    if len(tasks) == 1:
        # Otimizacao: sem overhead de thread para tarefa unica
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
```

## Por que e seguro

1. **Executors sao stateless**: cada executor (nmap, masscan, httpx, http_request) cria subprocessos independentes ou conexoes HTTP proprias -- sem estado compartilhado entre threads
2. **API calls sao thread-safe**: o `requests` do Python e thread-safe por design; cada POST para `agent-step-result` e independente
3. **Context e local**: cada tarefa cria seu proprio dict `context` em `_build_context()`, sem compartilhamento
4. **State file**: o `AgentState` nao e escrito durante a execucao de tarefas (apenas durante auth), entao nao ha race condition

## Secao Tecnica

- Apenas 1 arquivo modificado: `python-agent/agent/tasks.py`
- Usa `concurrent.futures` da stdlib do Python (sem dependencias novas)
- O `ThreadPoolExecutor` e ideal aqui porque as tarefas sao I/O-bound (subprocessos nmap/masscan, HTTP calls)
- O GIL do Python nao e problema porque o trabalho real acontece em subprocessos e I/O de rede
- Otimizacao para tarefa unica: evita overhead de criacao de thread pool quando so ha 1 tarefa

