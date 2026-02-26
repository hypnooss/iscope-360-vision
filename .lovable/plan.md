

## Separar pacotes no script de instalação

A arquitetura de cross-update ja esta implementada no Python (Supervisor, Worker, supervisor_updater) e no backend (agent-heartbeat, system_settings, coluna supervisor_version). Falta apenas atualizar os **scripts de instalacao** para baixar e instalar os dois pacotes separados.

### Estado atual

Ambos os scripts (`agent-install` e `super-agent-install`) tem uma funcao `download_release()` que baixa um unico `iscope-agent-latest.tar.gz` e extrai tudo em `$INSTALL_DIR`.

### Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/agent-install/index.ts` | Modificar `download_release()` para baixar 2 pacotes: `iscope-agent-latest.tar.gz` + `iscope-supervisor-latest.tar.gz` |
| `supabase/functions/super-agent-install/index.ts` | Mesma mudanca no `download_release()` |

### Nova logica de `download_release()`

```text
download_release() {
  # 1. Baixar pacote do Agent
  file_agent = "iscope-agent-latest.tar.gz" (ou versionado)
  curl → $tmp_agent
  
  # 2. Baixar pacote do Supervisor  
  file_sup = "iscope-supervisor-latest.tar.gz" (ou versionado)
  curl → $tmp_sup
  
  # 3. Limpar INSTALL_DIR (preservando venv, storage, logs, .env)
  # 4. Extrair pacote do Agent em INSTALL_DIR
  tar -xzf $tmp_agent -C $INSTALL_DIR
  
  # 5. Extrair pacote do Supervisor em INSTALL_DIR
  tar -xzf $tmp_sup -C $INSTALL_DIR
  
  # Resultado: INSTALL_DIR contém agent/ + supervisor/ + main.py + requirements.txt
}
```

### Bucket — Arquivos necessarios

Apos a implementacao, o bucket `agent-releases` precisara conter:

| Arquivo | Conteudo |
|---------|----------|
| `iscope-agent-latest.tar.gz` | `agent/`, `main.py`, `requirements.txt` |
| `iscope-supervisor-latest.tar.gz` | `supervisor/` |
| `iscope-agent-1.3.4.tar.gz` | Mesmo conteudo (para updates automaticos) |
| `iscope-supervisor-1.0.0.tar.gz` | Mesmo conteudo (para updates automaticos) |

### Versoes

- Agent: `1.3.4` (ja configurado em `agent/version.py`)
- Supervisor: `1.0.0` (ja configurado em `supervisor/version.py`)

