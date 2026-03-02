

## Diagnóstico: `-Command -` com stdin pipe causa deadlock nos cmdlets Exchange

O problema está 100% confirmado:

1. Manualmente com `pwsh -NonInteractive` interativo → `Get-AcceptedDomain` retorna instantaneamente
2. No agent com `pwsh -NonInteractive -Command -` (stdin pipe) → `CMD_START` chega, cmdlet trava por 120s

Os cmdlets Exchange usam **implicit remoting** (proxy functions que fazem chamadas WinRM remotas). No modo `-Command -`, o PowerShell mantém stdin aberto como pipe, e esses cmdlets remotos podem tentar ler de stdin internamente, causando deadlock.

## Solução: Trocar `-Command -` por `-File` com script temporário

Em vez de enviar comandos via stdin pipe, gerar um arquivo `.ps1` temporário com todo o preamble + comandos e executar com `pwsh -File script.ps1`. A leitura progressiva do stdout com marcadores permanece idêntica.

### Mudanças em `python-agent/agent/executors/powershell.py`

**1. Novo método `_build_script_file`**

Gera um arquivo `.ps1` temporário contendo:
- Preamble (import + connect + SESSION_READY marker)
- Todos os comandos com CMD_START/CMD_END markers
- Disconnect no final

**2. Modificar `run_interactive`**

Trocar:
```python
proc = subprocess.Popen(
    [pwsh, "-NoProfile", "-NonInteractive", "-Command", "-"],
    stdin=subprocess.PIPE, ...
)
proc.stdin.write(preamble)
# then write commands one by one via stdin
```

Por:
```python
script_path = self._build_script_file(preamble_lines, cmd_list, module)
proc = subprocess.Popen(
    [pwsh, "-NoProfile", "-NonInteractive", "-File", str(script_path)],
    stdin=subprocess.DEVNULL,  # Nenhum stdin! Elimina deadlock
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT, ...
)
# Read output progressively (mesma lógica de markers)
```

**3. Leitura progressiva inalterada**

A lógica de `_read_until_marker` para SESSION_READY, CMD_START, CMD_END continua idêntica. O timeout por comando também funciona igual — se um cmdlet travar, matamos o processo.

**4. Simplificações**

- Não precisa mais de `_drain_and_sync` (sem stdin para sincronizar)
- Não precisa mais de `_close_interactive_session` com stdin write (processo termina naturalmente ao final do script)
- Se houver timeout fatal (3 consecutivos), mata o processo com `proc.kill()` como já faz

**5. Cleanup**

Apagar o arquivo `.ps1` temporário no `finally` block.

### Por que isso resolve

- `stdin=subprocess.DEVNULL` → cmdlets Exchange não conseguem ler de stdin → sem deadlock
- Execução com `-File` é o mesmo modo que o usuário testou manualmente
- Zero mudança na lógica de parsing/markers/timeouts — só muda a fonte dos comandos

### Trade-off

- Todos os comandos são escritos no script antecipadamente (não podemos adicionar comandos dinamicamente mid-session)
- Isso não é problema porque `run_interactive` já recebe todos os steps no início

