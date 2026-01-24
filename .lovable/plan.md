

# Plano: Verificação de Conectividade com Fail-Fast

## Problema Identificado

Quando o agent não consegue se conectar ao firewall (DNS, rede, policy), ele tenta executar todos os 9 steps um por um, cada um falhando com timeout de 30s. Isso resulta em:
- Demora excessiva (potencialmente 9x30s = 4.5 minutos)
- Logs confusos com múltiplos erros repetidos
- Desperdício de recursos

## Solução Proposta

Implementar um mecanismo de **Connectivity Check + Fail-Fast** no Python agent que:
1. Executa o primeiro step como "probe de conectividade"
2. Se falhar com erro de conexão/timeout, aborta todos os demais steps
3. Reporta erro claro indicando problema de conectividade

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `python-agent/agent/tasks.py` | Adicionar lógica de fail-fast no método `execute()` |

## Mudanças Técnicas

### 1. Atualizar `TaskExecutor.execute()` em `tasks.py`

```python
def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
    """Execute all steps in a task with fail-fast on connectivity errors."""
    task_id = task.get('id', 'unknown')
    steps = task.get('steps', [])
    target = task.get('target', {})
    
    self.logger.info(f"Executando tarefa {task_id} com {len(steps)} steps")
    
    context = self._build_context(target)
    results = {}
    errors = []
    
    for i, step in enumerate(steps):
        step_id = step.get('id', 'unknown')
        executor_type = step.get('executor', 'unknown')
        
        executor = self._executors.get(executor_type)
        if not executor:
            results[step_id] = {'error': f"Executor desconhecido: {executor_type}"}
            errors.append(f"{step_id}: Executor desconhecido")
            continue
        
        try:
            result = executor.run(step, context)
            
            # Check for connectivity errors on first step (fail-fast)
            if i == 0 and result.get('error'):
                error_msg = result.get('error', '')
                if self._is_connectivity_error(error_msg):
                    self.logger.error(
                        f"Falha de conectividade no primeiro step. "
                        f"Abortando {len(steps) - 1} steps restantes."
                    )
                    results[step_id] = result
                    # Mark all remaining steps as skipped
                    for remaining_step in steps[1:]:
                        remaining_id = remaining_step.get('id', 'unknown')
                        results[remaining_id] = {
                            'error': 'Ignorado: falha de conectividade no step inicial',
                            'skipped': True
                        }
                    return {
                        'status': 'failed',
                        'result': results,
                        'error_message': f'Falha de conectividade: {error_msg}'
                    }
            
            if result.get('error'):
                errors.append(f"{step_id}: {result['error']}")
            results[step_id] = result.get('data') if result.get('data') is not None else result
            
        except Exception as e:
            results[step_id] = {'error': str(e)}
            errors.append(f"{step_id}: {str(e)}")
            
            # Also check for connectivity errors in exceptions
            if i == 0 and self._is_connectivity_error(str(e)):
                for remaining_step in steps[1:]:
                    remaining_id = remaining_step.get('id', 'unknown')
                    results[remaining_id] = {
                        'error': 'Ignorado: falha de conectividade no step inicial',
                        'skipped': True
                    }
                return {
                    'status': 'failed',
                    'result': results,
                    'error_message': f'Falha de conectividade: {str(e)}'
                }
    
    status = 'failed' if len(errors) == len(steps) and steps else 'completed'
    
    return {
        'status': status,
        'result': results,
        'error_message': '; '.join(errors) if errors else None
    }

def _is_connectivity_error(self, error_msg: str) -> bool:
    """Check if an error message indicates a connectivity problem."""
    connectivity_patterns = [
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
    error_lower = error_msg.lower()
    return any(pattern in error_lower for pattern in connectivity_patterns)
```

## Fluxo Atualizado

```text
Agent recebe task com 9 steps
         │
         ▼
┌─────────────────────────────────┐
│ Executa Step 1 (system_status)  │
└─────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
 Sucesso   Erro de
    │      Conectividade
    │         │
    ▼         ▼
Continua   ┌──────────────────────┐
Steps      │ FAIL-FAST            │
2-9        │ - Marca steps 2-9    │
           │   como "skipped"     │
           │ - Retorna imediato   │
           └──────────────────────┘
```

## Benefícios

1. **Resposta rápida**: Falha em segundos ao invés de minutos
2. **Logs claros**: Uma mensagem indicando problema de conectividade
3. **Histórico útil**: Steps não executados ficam marcados como `skipped`
4. **Sem mudanças no backend**: Toda a lógica fica no Python agent
5. **Retrocompatível**: Se o primeiro step passar, comportamento normal

## Comportamento Esperado

**Cenário: Firewall inacessível**
```
2026-01-24 15:14:38 [INFO] Executando tarefa xxx com 9 steps
2026-01-24 15:15:08 [ERROR] Step system_status: Timeout after 30s
2026-01-24 15:15:08 [ERROR] Falha de conectividade no primeiro step. Abortando 8 steps restantes.
2026-01-24 15:15:08 [INFO] Reportando resultado: failed
```

**Cenário: Firewall acessível**
```
2026-01-24 15:14:38 [INFO] Executando tarefa xxx com 9 steps
2026-01-24 15:14:39 [DEBUG] Step system_status: Success (200)
2026-01-24 15:14:40 [DEBUG] Step password_policy: Success (200)
... (continua normalmente)
```

