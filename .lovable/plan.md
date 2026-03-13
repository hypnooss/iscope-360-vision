

## Diagnóstico: `exoMessageTrace` vazio

### Causa Raiz Identificada

O comando no blueprint é:
```
Get-MessageTraceV2 -StartDate "{period_start}" -EndDate "{period_end}"
```

O `PowerShellExecutor` passa o comando **literalmente** ao PowerShell sem substituir os placeholders `{period_start}` e `{period_end}`. O resultado é que o PowerShell recebe as strings `"{period_start}"` e `"{period_end}"` como valores de data, o que causa falha silenciosa (retorna vazio ao invés de erro, porque o `catch` pode não capturá-lo ou o comando simplesmente não encontra resultados com datas inválidas).

**Evidência**: Na tabela `task_step_results`, o step `exo_message_trace` tem `status: success` mas `data: NULL`.

O `HTTPRequestExecutor` resolve `period_start` via `context.get('period_start')` para lógica de cutoff, mas o `PowerShellExecutor` nunca faz substituição de placeholders nos textos dos comandos.

### Correção

Adicionar resolução de placeholders no `PowerShellExecutor`, substituindo `{period_start}`, `{period_end}` e outros valores do context antes de executar cada comando.

**Arquivo**: `python-agent/agent/executors/powershell.py`

**Localização**: No método `run_interactive`, após construir `cmd_list` (linha ~497), adicionar substituição de placeholders usando o `context`:

```python
# Resolve placeholders in command text using context values
for cmd_info in cmd_list:
    cmd_text = cmd_info['command']
    for key in ('period_start', 'period_end'):
        placeholder = '{' + key + '}'
        if placeholder in cmd_text and key in context:
            cmd_text = cmd_text.replace(placeholder, context[key])
    cmd_info['command'] = cmd_text
```

Isso garante que `Get-MessageTraceV2 -StartDate "{period_start}" -EndDate "{period_end}"` seja resolvido para datas reais como `Get-MessageTraceV2 -StartDate "2026-03-13T01:00:00Z" -EndDate "2026-03-13T02:00:00Z"`.

### Verificação

O `context` já contém `period_start` e `period_end` — eles são propagados no `tasks.py` (linhas 92-94) a partir do `payload` da task, e o `trigger-m365-analyzer` já inclui esses valores no payload.

### Arquivo modificado
- `python-agent/agent/executors/powershell.py` — substituição de placeholders no comando antes da execução

