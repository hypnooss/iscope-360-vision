
# Otimizar PowerShell: Sessao Unica com Envio Progressivo

## Problema atual

Para 18 steps PowerShell, o agente abre 18 processos `pwsh` independentes. Cada um faz Import-Module, Connect-ExchangeOnline, executa 1 comando, Disconnect. Overhead de ~5s por step = ~90s so em conexoes.

## Solucao

Agrupar steps PowerShell consecutivos do mesmo modulo em uma unica chamada ao executor. O executor ja suporta multiplos comandos (o array `commands` no `_build_script`). Apos a execucao, desempacotar os resultados e reportar cada step individualmente via `_report_step_result`.

```text
ANTES (18 steps):
  Step 1 -> pwsh: Import + Connect + Cmd1 + Disconnect -> report step 1
  Step 2 -> pwsh: Import + Connect + Cmd2 + Disconnect -> report step 2
  ...
  Step 18 -> pwsh: Import + Connect + Cmd18 + Disconnect -> report step 18

DEPOIS (1 batch):
  Steps 1-18 -> pwsh: Import + Connect + Cmd1..Cmd18 + Disconnect
             -> parse results
             -> report step 1, report step 2, ..., report step 18
```

## Alteracoes

### 1. `python-agent/agent/tasks.py` - Agrupar steps PowerShell

No metodo `execute()`, antes do loop principal, identificar sequencias de steps PowerShell com o mesmo modulo e agrupa-los. O loop principal passa a processar "batches":

- Se o step e PowerShell, acumula no batch atual
- Se muda de tipo/modulo, executa o batch pendente e reporta cada resultado
- Steps nao-PowerShell continuam executando individualmente

Logica principal:

```python
def _execute_powershell_batch(self, task_id, steps, context):
    """Execute multiple PowerShell steps in a single session."""
    # Merge all commands into one executor call
    merged_step = {
        'type': 'powershell',
        'params': {
            **steps[0].get('params', {}),
            'commands': []
        }
    }
    for step in steps:
        cmds = step.get('params', {}).get('commands', [])
        merged_step['params']['commands'].extend(cmds)
    
    # Single execution (1 pwsh process, 1 Connect-ExchangeOnline)
    result = self._executors['powershell'].run(merged_step, context)
    
    # Unpack and report each step individually
    data = result.get('data', {})
    for step in steps:
        step_id = step.get('id')
        cmd_name = step['params']['commands'][0]['name']
        step_data = data.get(cmd_name, {}) if isinstance(data, dict) else None
        # ... determine status, report via _report_step_result
```

### 2. `python-agent/agent/executors/powershell.py` - Aumentar timeout padrao

Alterar o timeout padrao de 300s para 600s quando executando batches com muitos comandos (o caller pode passar `timeout` no params).

## Comportamento preservado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Envio progressivo por step | Sim | Sim (desempacota apos execucao) |
| Fail-fast em erro de conectividade | Sim (step 1) | Sim (batch inteiro falha) |
| Visibilidade no dashboard | Cada step com status | Identico |
| Credential mode | Suportado | Suportado (mesmo merge) |

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `python-agent/agent/tasks.py` | Adicionar `_execute_powershell_batch()` e logica de agrupamento no `execute()` |
| `python-agent/agent/executors/powershell.py` | Ajustar timeout padrao para batches grandes |
