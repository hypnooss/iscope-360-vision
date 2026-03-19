

## Causa raiz confirmada

```
ModuleNotFoundError: No module named 'monitor'
```

**Linha 46 de `supervisor/main.py`**: `from monitor.worker import MonitorWorker`

O pacote de update do Supervisor só copia a pasta `supervisor/`. O módulo `monitor/` vive fora, em `/opt/iscope-agent/monitor/`. Se o `monitor/` não foi instalado nesse servidor (ou foi removido por algum update anterior), o Supervisor novo morre no boot.

Isso é um problema de **acoplamento forte em tempo de import** com um módulo que pode não existir no ambiente.

## Correção

### 1. Tornar o import do `monitor` lazy/opcional em `supervisor/main.py`

Em vez de importar `MonitorWorker` no topo do arquivo (quebrando o boot inteiro se não existir), mover para um import local com fallback:

```python
# Linha 46: remover "from monitor.worker import MonitorWorker"

# Na função main(), onde o MonitorWorker é instanciado (~linha 98):
try:
    from monitor.worker import MonitorWorker
    monitor_thread = MonitorWorker(...)
    monitor_thread.start()
    monitor_available = True
except ImportError:
    logger.warning("[Supervisor] Módulo 'monitor' não encontrado — monitoramento desativado")
    monitor_thread = None
    monitor_available = False
```

Fazer o mesmo para todos os usos de `monitor_thread` no loop principal (stop, update, etc.) — checar `if monitor_thread:` antes de usar.

### 2. Proteger o smoke test no updater

O smoke test atual já cria symlinks para `agent/` e `monitor/` se existirem. Isso já está correto. Mas o import test não testa `from monitor.worker import MonitorWorker` — se esse import fosse testado, o smoke test falharia corretamente nos servidores sem `monitor/`. Com o import agora sendo lazy, isso deixa de ser bloqueante.

### 3. Incluir `monitor/` no pacote do Supervisor (opcional, longo prazo)

Alternativa futura: o pacote `iscope-supervisor-<version>.tar.gz` poderia incluir `monitor/` junto, já que o Supervisor é o responsável por gerenciar o monitor. Mas isso é uma mudança de empacotamento que pode ser feita depois. A correção imediata é o import lazy.

## Arquivos a editar

- `python-agent/supervisor/main.py` — tornar import de `monitor.worker` lazy com try/except, proteger todos os usos de `monitor_thread` com checagem None

## Resultado

O Supervisor consegue subir mesmo que `monitor/` não esteja presente. O monitoramento fica desativado com um warning no log, mas o serviço não morre. Quando `monitor/` for deployado, o próximo restart do Supervisor vai encontrá-lo e ativá-lo normalmente.

