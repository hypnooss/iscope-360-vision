

# Plano: Sistema de Auto-Update para Python Agent

## Problema

Agents instalados em servidores remotos não têm mecanismo para receber atualizações automáticas. Atualmente, a única forma de atualizar é:
1. SSH manual no servidor
2. Executar o instalador novamente com `--update`

---

## Estratégias Consideradas

| Estratégia | Descrição | Prós | Contras |
|------------|-----------|------|---------|
| **A. Flag no Heartbeat** | Backend sinaliza "update disponível" no heartbeat | Simples, baixo overhead | Agent precisa saber como se atualizar |
| **B. Self-Update Script** | Agent baixa e executa script de update | Controle total | Complexidade, risco de falha |
| **C. Versionamento + Auto-restart** | Agent detecta nova versão, baixa, substitui e reinicia systemd | Mais robusto | Mais complexo, precisa de permissões |
| **D. Híbrido (Recomendado)** | Backend sinaliza via heartbeat + Agent executa update controlado | Melhor dos dois mundos | Implementação mais completa |

**Recomendação:** Estratégia D (Híbrida)

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (Supabase)                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  system_settings                                                  │  │
│  │  - agent_latest_version: "1.1.0"                                  │  │
│  │  - agent_update_url: "/storage/.../iscope-agent-1.1.0.tar.gz"     │  │
│  │  - agent_update_checksum: "sha256:abc123..."                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Edge Function: agent-heartbeat                                   │  │
│  │  - Compara agent_version do request com agent_latest_version      │  │
│  │  - Se diferente: retorna update_available: true + metadata        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Python Agent                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Heartbeat Response Handler                                       │  │
│  │  - Se update_available: true, chama AutoUpdater                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AutoUpdater (novo módulo)                                        │  │
│  │  1. Baixa o novo pacote para /tmp                                 │  │
│  │  2. Verifica checksum SHA256                                      │  │
│  │  3. Extrai para diretório temporário                              │  │
│  │  4. Executa script de migração (se existir)                       │  │
│  │  5. Substitui arquivos em INSTALL_DIR                             │  │
│  │  6. Solicita restart via systemctl (ou sinal)                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Backend - Sinalização de Update

### 1.1 Nova coluna em system_settings

Adicionar configurações de versão no banco:

```sql
-- Inserir configurações de versão do agent
INSERT INTO system_settings (key, value) VALUES
  ('agent_latest_version', '"1.0.0"'),
  ('agent_update_checksum', '""'),
  ('agent_force_update', 'false')
ON CONFLICT (key) DO NOTHING;
```

### 1.2 Atualizar Edge Function agent-heartbeat

Modificar a resposta do heartbeat para incluir informações de update:

```typescript
// Nova interface de resposta
interface HeartbeatSuccessResponse {
  success: true;
  agent_id: string;
  timestamp: string;
  next_heartbeat_in: number;
  config_flag: 0 | 1;
  has_pending_tasks: boolean;
  // NOVOS CAMPOS
  update_available: boolean;
  update_info?: {
    version: string;
    download_url: string;
    checksum: string;
    force: boolean;
  };
}
```

Lógica adicional:

```typescript
// Buscar versão do agent no request body
const requestBody = await req.json();
const agentVersion = requestBody.agent_version || '0.0.0';

// Buscar versão mais recente do system_settings
const { data: settings } = await supabase
  .from('system_settings')
  .select('key, value')
  .in('key', ['agent_latest_version', 'agent_update_checksum', 'agent_force_update']);

const latestVersion = settings?.find(s => s.key === 'agent_latest_version')?.value || '1.0.0';
const checksum = settings?.find(s => s.key === 'agent_update_checksum')?.value || '';
const forceUpdate = settings?.find(s => s.key === 'agent_force_update')?.value === 'true';

// Comparar versões
const updateAvailable = compareVersions(agentVersion, latestVersion) < 0;

// Incluir na resposta
response.update_available = updateAvailable;
if (updateAvailable) {
  response.update_info = {
    version: latestVersion,
    download_url: `${STORAGE_URL}/agent-releases/iscope-agent-${latestVersion}.tar.gz`,
    checksum: checksum,
    force: forceUpdate
  };
}
```

---

## Fase 2: Python Agent - AutoUpdater

### 2.1 Novo módulo: `python-agent/agent/updater.py`

```python
"""
AutoUpdater - Handles automatic agent updates.

Flow:
1. Receive update info from heartbeat
2. Download new package to temp location
3. Verify checksum
4. Extract and validate contents
5. Replace current installation
6. Signal systemd to restart
"""

import hashlib
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from typing import Dict, Optional

import requests


class AutoUpdater:
    """Handles automatic agent updates with safety checks."""

    def __init__(self, logger, install_dir: str = "/opt/iscope-agent"):
        self.logger = logger
        self.install_dir = Path(install_dir)
        self.backup_dir = self.install_dir.parent / "iscope-agent-backup"

    def check_and_update(self, update_info: Dict) -> bool:
        """
        Check update info and perform update if valid.
        
        Args:
            update_info: Dict with version, download_url, checksum, force
            
        Returns:
            True if update was successful and restart is needed
        """
        version = update_info.get('version')
        download_url = update_info.get('download_url')
        expected_checksum = update_info.get('checksum', '')
        force = update_info.get('force', False)

        if not version or not download_url:
            self.logger.warning("Update info incompleto, ignorando")
            return False

        self.logger.info(f"Iniciando atualização para versão {version}")

        try:
            # 1. Download para temp
            tmp_file = self._download_package(download_url)
            if not tmp_file:
                return False

            # 2. Verificar checksum (se fornecido)
            if expected_checksum:
                if not self._verify_checksum(tmp_file, expected_checksum):
                    self.logger.error("Checksum inválido, abortando update")
                    os.remove(tmp_file)
                    return False

            # 3. Extrair para temp
            extract_dir = self._extract_package(tmp_file)
            os.remove(tmp_file)
            
            if not extract_dir:
                return False

            # 4. Validar conteúdo (deve ter main.py, requirements.txt)
            if not self._validate_package(extract_dir):
                shutil.rmtree(extract_dir)
                return False

            # 5. Backup atual
            self._backup_current()

            # 6. Substituir arquivos
            self._replace_files(extract_dir)
            shutil.rmtree(extract_dir)

            # 7. Reinstalar dependências se requirements mudou
            self._update_dependencies()

            self.logger.info(f"Update para {version} concluído com sucesso")
            
            # 8. Solicitar restart
            self._request_restart()
            
            return True

        except Exception as e:
            self.logger.error(f"Erro durante update: {e}")
            self._restore_backup()
            return False

    def _download_package(self, url: str) -> Optional[str]:
        """Download package to temp file."""
        try:
            self.logger.info(f"Baixando pacote de {url}")
            response = requests.get(url, stream=True, timeout=120)
            response.raise_for_status()

            tmp_file = tempfile.mktemp(suffix='.tar.gz')
            with open(tmp_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            self.logger.info(f"Download concluído: {tmp_file}")
            return tmp_file

        except Exception as e:
            self.logger.error(f"Erro no download: {e}")
            return None

    def _verify_checksum(self, filepath: str, expected: str) -> bool:
        """Verify SHA256 checksum."""
        sha256 = hashlib.sha256()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)

        actual = sha256.hexdigest()
        
        # Handle both "sha256:xxx" and plain "xxx" formats
        if expected.startswith('sha256:'):
            expected = expected[7:]

        if actual == expected:
            self.logger.info("Checksum verificado com sucesso")
            return True
        else:
            self.logger.error(f"Checksum mismatch: esperado {expected}, recebido {actual}")
            return False

    def _extract_package(self, filepath: str) -> Optional[str]:
        """Extract tar.gz to temp directory."""
        try:
            extract_dir = tempfile.mkdtemp(prefix='iscope-update-')
            with tarfile.open(filepath, 'r:gz') as tar:
                tar.extractall(extract_dir)

            self.logger.info(f"Pacote extraído em {extract_dir}")
            return extract_dir

        except Exception as e:
            self.logger.error(f"Erro na extração: {e}")
            return None

    def _validate_package(self, extract_dir: str) -> bool:
        """Validate package contains required files."""
        required_files = ['main.py', 'requirements.txt', 'agent/__init__.py']
        
        # Find the actual root (might be nested)
        root = Path(extract_dir)
        if not (root / 'main.py').exists():
            # Check for nested folder
            subdirs = list(root.iterdir())
            if len(subdirs) == 1 and subdirs[0].is_dir():
                root = subdirs[0]

        for file in required_files:
            if not (root / file).exists():
                self.logger.error(f"Arquivo obrigatório ausente: {file}")
                return False

        self.logger.info("Validação do pacote OK")
        return True

    def _backup_current(self):
        """Backup current installation."""
        if self.backup_dir.exists():
            shutil.rmtree(self.backup_dir)
        
        if self.install_dir.exists():
            shutil.copytree(self.install_dir, self.backup_dir, dirs_exist_ok=True)
            self.logger.info(f"Backup criado em {self.backup_dir}")

    def _replace_files(self, extract_dir: str):
        """Replace current files with new ones."""
        root = Path(extract_dir)
        
        # Find actual root
        if not (root / 'main.py').exists():
            subdirs = list(root.iterdir())
            if len(subdirs) == 1 and subdirs[0].is_dir():
                root = subdirs[0]

        # Preserve venv and state
        preserved = ['venv', 'storage', 'logs']
        
        for item in self.install_dir.iterdir():
            if item.name not in preserved:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

        # Copy new files
        for item in root.iterdir():
            dest = self.install_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)

        self.logger.info("Arquivos substituídos com sucesso")

    def _update_dependencies(self):
        """Update pip dependencies if requirements.txt changed."""
        venv_pip = self.install_dir / 'venv' / 'bin' / 'pip'
        requirements = self.install_dir / 'requirements.txt'

        if venv_pip.exists() and requirements.exists():
            self.logger.info("Atualizando dependências...")
            try:
                subprocess.run(
                    [str(venv_pip), 'install', '-r', str(requirements)],
                    capture_output=True,
                    timeout=300
                )
            except Exception as e:
                self.logger.warning(f"Erro ao atualizar dependências: {e}")

    def _restore_backup(self):
        """Restore from backup on failure."""
        if self.backup_dir.exists():
            self.logger.info("Restaurando backup...")
            shutil.rmtree(self.install_dir, ignore_errors=True)
            shutil.copytree(self.backup_dir, self.install_dir)
            self.logger.info("Backup restaurado")

    def _request_restart(self):
        """Request systemd to restart the service."""
        self.logger.info("Solicitando restart do serviço...")
        try:
            # Option 1: systemctl (requires sudo/polkit)
            subprocess.run(
                ['systemctl', 'restart', 'iscope-agent'],
                capture_output=True,
                timeout=30
            )
        except Exception as e:
            self.logger.warning(f"Não foi possível reiniciar via systemctl: {e}")
            # Option 2: Exit and let systemd restart us
            self.logger.info("Saindo para permitir restart pelo systemd...")
            sys.exit(0)
```

### 2.2 Integrar no main.py

Modificar o loop principal para processar updates:

```python
# Em AgentApp.__init__
from agent.updater import AutoUpdater
self.updater = AutoUpdater(logger)

# Em agent_loop(), após processar heartbeat:
if result.get('update_available') and result.get('update_info'):
    self.logger.info("Atualização disponível detectada")
    update_info = result['update_info']
    
    # Verificar se é update forçado ou se podemos adiar
    if update_info.get('force') or not result.get('has_pending_tasks'):
        if self.updater.check_and_update(update_info):
            # Update succeeded, process will restart
            return next_interval
    else:
        self.logger.info("Adiando update - há tarefas pendentes")
```

### 2.3 Versionamento no Agent

Criar `python-agent/agent/version.py`:

```python
"""Agent version information."""

__version__ = "1.0.0"

def get_version() -> str:
    return __version__
```

Atualizar main.py para usar:

```python
from agent.version import get_version

# No heartbeat.send():
result = self.heartbeat.send(
    status="running",
    version=get_version()
)
```

---

## Fase 3: Processo de Release

### 3.1 Workflow de Deploy

1. **Atualizar código** no repositório
2. **Atualizar versão** em `python-agent/agent/version.py`
3. **Empacotar**: 
   ```bash
   cd python-agent
   tar -czvf iscope-agent-1.1.0.tar.gz \
     --exclude='*.pyc' \
     --exclude='__pycache__' \
     --exclude='venv' \
     --exclude='storage' \
     --exclude='logs' \
     --exclude='.env' \
     .
   ```
4. **Calcular checksum**:
   ```bash
   sha256sum iscope-agent-1.1.0.tar.gz
   ```
5. **Upload** para Supabase Storage (bucket `agent-releases`)
6. **Atualizar** system_settings:
   ```sql
   UPDATE system_settings SET value = '"1.1.0"' WHERE key = 'agent_latest_version';
   UPDATE system_settings SET value = '"sha256:abc123..."' WHERE key = 'agent_update_checksum';
   ```

### 3.2 Rollback

Para reverter uma versão:

```sql
-- Voltar para versão anterior
UPDATE system_settings SET value = '"1.0.0"' WHERE key = 'agent_latest_version';
UPDATE system_settings SET value = '"sha256:old_checksum"' WHERE key = 'agent_update_checksum';
```

Agents baixarão a versão anterior no próximo heartbeat.

---

## Resumo de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/agent-heartbeat/index.ts` | Editar | Adicionar lógica de update_available |
| `python-agent/agent/version.py` | Criar | Versão do agent centralizada |
| `python-agent/agent/updater.py` | Criar | Módulo de auto-update |
| `python-agent/main.py` | Editar | Integrar AutoUpdater no loop |
| `python-agent/agent/heartbeat.py` | Editar | Usar version.py |
| Migration SQL | Criar | Adicionar settings de versão |

---

## Segurança

| Aspecto | Proteção |
|---------|----------|
| Download | HTTPS obrigatório |
| Integridade | Checksum SHA256 verificado |
| Rollback | Backup automático antes de update |
| Permissões | Apenas arquivos de código são substituídos |
| Timing | Updates adiados se há tarefas em execução |

---

## Fluxo Visual

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Agent     │     │   Backend    │     │   Storage    │
│  v1.0.0      │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  Heartbeat         │                    │
       │  version=1.0.0     │                    │
       │───────────────────>│                    │
       │                    │                    │
       │  update_available  │                    │
       │  version=1.1.0     │                    │
       │  checksum=abc...   │                    │
       │<───────────────────│                    │
       │                    │                    │
       │  Download package  │                    │
       │────────────────────────────────────────>│
       │                    │                    │
       │  iscope-agent-1.1.0.tar.gz             │
       │<────────────────────────────────────────│
       │                    │                    │
       │ ┌────────────────┐ │                    │
       │ │ Verify checksum│ │                    │
       │ │ Backup current │ │                    │
       │ │ Extract & copy │ │                    │
       │ │ Restart service│ │                    │
       │ └────────────────┘ │                    │
       │                    │                    │
   ┌───┴───┐                │                    │
   │ Agent │                │                    │
   │ v1.1.0│                │                    │
   └───────┘                │                    │
```

