

# Remover timestamp duplicado nos logs do Worker

## Problema

Quando o Supervisor drena o stdout do Worker, ele usa `logger.info(f"[Worker] {line}")`, o que adiciona o timestamp do Supervisor **sobre** o timestamp que o Worker já escreveu. Resultado:

```
2026-02-25 11:26:29,592 [INFO] [Worker] 2026-02-25 11:24:31,607 [INFO] Início do loop...
```

Dois timestamps + dois `[INFO]` na mesma linha = confusão.

## Solução

No `supervisor/main.py`, linhas 131-135, em vez de usar `logger.info()` (que injeta timestamp do Supervisor), usar `print()` direto para stdout. Como o Supervisor já roda via systemd/journald, o `print()` vai para o journal sem timestamp extra — o Worker já tem o seu próprio.

Alternativa mais limpa: manter `logger` mas com um handler separado sem formatter para as linhas do Worker. Porém o mais simples e eficaz é:

```python
# Drain worker stdout to our log
output = worker.collect_output()
if output:
    for line in output.split("\n"):
        if line.strip():
            print(f"[Worker] {line}", flush=True)
```

Isso mantém o prefixo `[Worker]` para identificação, mas preserva apenas o timestamp original do Worker.

## Mudança

| Arquivo | Linhas | Descrição |
|---|---|---|
| `python-agent/supervisor/main.py` | 131-135 | Trocar `logger.info()` por `print()` para linhas do Worker, evitando timestamp duplicado |

