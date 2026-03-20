"""
AutoUpdater - Handles automatic agent updates.

Flow:
1. Receive update info from heartbeat
2. Download new package to temp location
3. Verify checksum
4. Extract and validate contents
5. Replace current installation
6. Ensure system components are installed
7. Signal systemd to restart
"""

import hashlib
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

import requests

from agent.components import ensure_system_components


class AutoUpdater:
    """Handles automatic agent updates with safety checks."""

    def __init__(self, logger, install_dir: str = "/opt/iscope-agent"):
        self.logger = logger
        self.install_dir = Path(install_dir)
        # Backup dir in /var/lib/iscope-agent/backup (user iscope has write access)
        self.backup_dir = Path("/var/lib/iscope-agent/backup")

    def check_and_update(self, update_info: Dict[str, Any]) -> bool:
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

            # 6.1. Garantir line endings Unix nos scripts shell
            self._fix_shell_line_endings()

            # 7. Reinstalar dependências se requirements mudou
            self._update_dependencies()

            # 8. Verificar e instalar componentes do sistema
            ensure_system_components(self.logger)

            self.logger.info(f"Update para {version} concluído com sucesso")

            # 9. Solicitar restart
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

            fd, tmp_file = tempfile.mkstemp(suffix='.tar.gz')
            os.close(fd)
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

        if actual.lower() == expected.lower():
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
                # Security: prevent path traversal attacks
                for member in tar.getmembers():
                    if member.name.startswith('/') or '..' in member.name:
                        raise ValueError(f"Path traversal detected: {member.name}")
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
            subdirs = [d for d in root.iterdir() if d.is_dir()]
            if len(subdirs) == 1:
                root = subdirs[0]

        for file in required_files:
            if not (root / file).exists():
                self.logger.error(f"Arquivo obrigatório ausente: {file}")
                return False

        self.logger.info("Validação do pacote OK")
        return True

    def _backup_current(self) -> None:
        """Backup current installation."""
        if self.backup_dir.exists():
            shutil.rmtree(self.backup_dir)

        if self.install_dir.exists():
            shutil.copytree(self.install_dir, self.backup_dir, dirs_exist_ok=True)
            self.logger.info(f"Backup criado em {self.backup_dir}")

    def _replace_files(self, extract_dir: str) -> None:
        """Replace current files with new ones."""
        root = Path(extract_dir)

        # Find actual root
        if not (root / 'main.py').exists():
            subdirs = [d for d in root.iterdir() if d.is_dir()]
            if len(subdirs) == 1:
                root = subdirs[0]

        # Preserve venv, state, and logs
        preserved = ['venv', 'storage', 'logs', '.env', 'supervisor']

        for item in self.install_dir.iterdir():
            if item.name not in preserved:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

        # Copy new files
        for item in root.iterdir():
            if item.name in preserved:
                continue  # Don't overwrite preserved files from package
            dest = self.install_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)

        self.logger.info("Arquivos substituídos com sucesso")

    def _update_dependencies(self) -> None:
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
                self.logger.info("Dependências atualizadas")
            except Exception as e:
                self.logger.warning(f"Erro ao atualizar dependências: {e}")

    def _fix_shell_line_endings(self) -> None:
        """Ensure all .sh files have Unix line endings (LF)."""
        for sh_file in self.install_dir.glob('*.sh'):
            try:
                content = sh_file.read_bytes()
                if b'\r\n' in content:
                    content = content.replace(b'\r\n', b'\n')
                    sh_file.write_bytes(content)
                    self.logger.info(f"Line endings corrigidos: {sh_file.name}")
            except Exception as e:
                self.logger.warning(f"Erro ao corrigir line endings de {sh_file.name}: {e}")

    def _restore_backup(self) -> None:
        """Restore from backup on failure."""
        if self.backup_dir.exists():
            self.logger.info("Restaurando backup...")
            shutil.rmtree(self.install_dir, ignore_errors=True)
            shutil.copytree(self.backup_dir, self.install_dir)
            self.logger.info("Backup restaurado")

    def _request_restart(self) -> None:
        """Request systemd to restart the service."""
        self.logger.info("Solicitando restart do serviço...")
        try:
            # Option 1: systemctl (requires sudo/polkit)
            result = subprocess.run(
                ['systemctl', 'restart', 'iscope-supervisor'],
                capture_output=True,
                timeout=30
            )
            if result.returncode == 0:
                self.logger.info("Restart solicitado via systemctl")
                return
        except Exception as e:
            self.logger.warning(f"Não foi possível reiniciar via systemctl: {e}")

        # Option 2: Exit and let systemd restart us
        self.logger.info("Saindo para permitir restart pelo systemd...")
        sys.exit(0)
