
# Plano: Corrigir Localização do Diretório de Backup do AutoUpdater

## Problema Identificado

O auto-update falha com:
```
[ERROR] Erro durante update: [Errno 13] Permission denied: '/opt/iscope-agent-backup'
```

**Causa**: O `AutoUpdater` tenta criar o backup em `/opt/iscope-agent-backup`, mas:
1. O agent roda como usuário `iscope`
2. O diretório `/opt` pertence a `root`
3. O usuário `iscope` não pode criar diretórios em `/opt`

## Solução

Mover o diretório de backup para dentro de `/var/lib/iscope-agent/backup`, onde o usuário `iscope` já tem permissões.

---

### Arquivo: `python-agent/agent/updater.py`

**Alteração no construtor (linhas 29-32):**

De:
```python
def __init__(self, logger, install_dir: str = "/opt/iscope-agent"):
    self.logger = logger
    self.install_dir = Path(install_dir)
    self.backup_dir = self.install_dir.parent / "iscope-agent-backup"
```

Para:
```python
def __init__(self, logger, install_dir: str = "/opt/iscope-agent"):
    self.logger = logger
    self.install_dir = Path(install_dir)
    # Backup dir in /var/lib/iscope-agent/backup (user iscope has write access)
    self.backup_dir = Path("/var/lib/iscope-agent/backup")
```

---

## Resumo

| Local | Alteração |
|-------|-----------|
| `updater.py` linha 32 | Mudar `backup_dir` de `/opt/iscope-agent-backup` para `/var/lib/iscope-agent/backup` |

---

## Resultado Esperado

Após a correção:
1. O backup será criado em `/var/lib/iscope-agent/backup`
2. O usuário `iscope` já tem permissão nesse diretório
3. O auto-update funcionará corretamente

---

## Próximos Passos Após Aprovação

1. Atualizar o arquivo `python-agent/agent/updater.py`
2. Criar uma nova release (v1.1.1) com a correção
3. Fazer upload para o bucket `agent-releases`
4. O agent irá baixar a atualização automaticamente no próximo heartbeat

---

## Solução Imediata (enquanto a correção não é deployada)

Para corrigir o servidor atual, execute:
```bash
sudo mkdir -p /opt/iscope-agent-backup
sudo chown iscope:iscope /opt/iscope-agent-backup
sudo systemctl restart iscope-agent
```

Isso permitirá que o auto-update funcione até que a nova versão com a correção seja instalada.
