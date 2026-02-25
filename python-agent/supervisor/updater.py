"""
SupervisorUpdater — Orchestrates worker updates safely.

Unlike the old AutoUpdater (which ran inside the process it was updating),
this updater runs in the Supervisor and can:
1. Stop the Worker before touching any files
2. Update files, reinstall deps, run system component checks
3. Start the Worker with the new code
"""

import hashlib
import os
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from agent.components import ensure_system_components


class SupervisorUpdater:
    """Handles worker updates from the Supervisor process."""

    def __init__(self, logger, install_dir: Path):
        self.logger = logger
        self.install_dir = install_dir
        self.backup_dir = Path("/var/lib/iscope-agent/backup")

    def check_and_update(self, update_info: Dict[str, Any], worker_manager) -> bool:
        """
        Download, validate, and apply a worker update.

        Args:
            update_info: Dict with version, download_url, checksum, force
            worker_manager: WorkerManager instance to stop/start the worker

        Returns:
            True if update succeeded and worker was restarted
        """
        version = update_info.get("version")
        download_url = update_info.get("download_url")
        expected_checksum = update_info.get("checksum", "")

        if not version or not download_url:
            self.logger.warning("[Updater] Info de update incompleta, ignorando")
            return False

        self.logger.info(f"[Updater] Iniciando atualização do Worker para v{version}")

        try:
            # 1. Download
            tmp_file = self._download_package(download_url)
            if not tmp_file:
                return False

            # 2. Verify checksum
            if expected_checksum and not self._verify_checksum(tmp_file, expected_checksum):
                self.logger.error("[Updater] Checksum inválido, abortando")
                os.remove(tmp_file)
                return False

            # 3. Extract
            extract_dir = self._extract_package(tmp_file)
            os.remove(tmp_file)
            if not extract_dir:
                return False

            # 4. Validate
            if not self._validate_package(extract_dir):
                shutil.rmtree(extract_dir)
                return False

            # 5. STOP the worker (safe — we're in a separate process)
            self.logger.info("[Updater] Parando Worker para aplicar update...")
            worker_manager.stop(timeout=60)

            # 6. Backup current
            self._backup_current()

            # 7. Replace files
            self._replace_files(extract_dir)
            shutil.rmtree(extract_dir)

            # 8. Fix shell line endings
            self._fix_shell_line_endings()

            # 9. Reinstall dependencies
            self._update_dependencies()

            # 10. System components (PowerShell, certs, etc.)
            try:
                ensure_system_components(self.logger)
            except Exception as e:
                self.logger.warning(f"[Updater] Erro em componentes do sistema: {e}")

            # 10.5. Reload agent.version module to break update loop
            self._reload_version_module(version)

            self.logger.info(f"[Updater] Update para v{version} concluído")

            # 11. Start the worker with new code
            self.logger.info("[Updater] Reiniciando Worker...")
            worker_manager.start()

            return True

        except Exception as e:
            self.logger.error(f"[Updater] Erro durante update: {e}")
            self._restore_backup()
            # Try to restart worker even after failure
            try:
                worker_manager.start()
            except Exception:
                pass
            return False

    # ------------------------------------------------------------------
    # Download / verify / extract (reused from old AutoUpdater)
    # ------------------------------------------------------------------

    def _download_package(self, url: str) -> Optional[str]:
        try:
            import requests
            self.logger.info(f"[Updater] Baixando pacote de {url}")
            response = requests.get(url, stream=True, timeout=120)
            response.raise_for_status()

            tmp_file = tempfile.mktemp(suffix=".tar.gz")
            with open(tmp_file, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            self.logger.info(f"[Updater] Download concluído: {tmp_file}")
            return tmp_file
        except Exception as e:
            self.logger.error(f"[Updater] Erro no download: {e}")
            return None

    def _verify_checksum(self, filepath: str, expected: str) -> bool:
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)

        actual = sha256.hexdigest()
        if expected.startswith("sha256:"):
            expected = expected[7:]

        if actual.lower() == expected.lower():
            self.logger.info("[Updater] Checksum OK")
            return True
        self.logger.error(f"[Updater] Checksum mismatch: esperado {expected}, recebido {actual}")
        return False

    def _extract_package(self, filepath: str) -> Optional[str]:
        try:
            extract_dir = tempfile.mkdtemp(prefix="iscope-update-")
            with tarfile.open(filepath, "r:gz") as tar:
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in member.name:
                        raise ValueError(f"Path traversal detected: {member.name}")
                tar.extractall(extract_dir)
            self.logger.info(f"[Updater] Pacote extraído em {extract_dir}")
            return extract_dir
        except Exception as e:
            self.logger.error(f"[Updater] Erro na extração: {e}")
            return None

    def _validate_package(self, extract_dir: str) -> bool:
        required_files = ["main.py", "requirements.txt", "agent/__init__.py"]
        root = Path(extract_dir)
        if not (root / "main.py").exists():
            subdirs = [d for d in root.iterdir() if d.is_dir()]
            if len(subdirs) == 1:
                root = subdirs[0]

        for f in required_files:
            if not (root / f).exists():
                self.logger.error(f"[Updater] Arquivo obrigatório ausente: {f}")
                return False

        self.logger.info("[Updater] Validação do pacote OK")
        return True

    # ------------------------------------------------------------------
    # File replacement
    # ------------------------------------------------------------------

    def _backup_current(self) -> None:
        if self.backup_dir.exists():
            shutil.rmtree(self.backup_dir)
        if self.install_dir.exists():
            shutil.copytree(self.install_dir, self.backup_dir, dirs_exist_ok=True)
            self.logger.info(f"[Updater] Backup criado em {self.backup_dir}")

    def _replace_files(self, extract_dir: str) -> None:
        root = Path(extract_dir)
        if not (root / "main.py").exists():
            subdirs = [d for d in root.iterdir() if d.is_dir()]
            if len(subdirs) == 1:
                root = subdirs[0]

        preserved = {"venv", "storage", "logs", ".env"}

        for item in self.install_dir.iterdir():
            if item.name not in preserved:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

        for item in root.iterdir():
            if item.name in preserved:
                continue
            dest = self.install_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)

        self.logger.info("[Updater] Arquivos substituídos com sucesso")

    def _fix_shell_line_endings(self) -> None:
        for sh_file in self.install_dir.glob("*.sh"):
            try:
                content = sh_file.read_bytes()
                if b"\r\n" in content:
                    sh_file.write_bytes(content.replace(b"\r\n", b"\n"))
                    self.logger.info(f"[Updater] Line endings corrigidos: {sh_file.name}")
            except Exception as e:
                self.logger.warning(f"[Updater] Erro ao corrigir {sh_file.name}: {e}")

    def _update_dependencies(self) -> None:
        venv_pip = self.install_dir / "venv" / "bin" / "pip"
        requirements = self.install_dir / "requirements.txt"

        if venv_pip.exists() and requirements.exists():
            self.logger.info("[Updater] Atualizando dependências...")
            try:
                subprocess.run(
                    [str(venv_pip), "install", "-r", str(requirements)],
                    capture_output=True,
                    timeout=300,
                )
                self.logger.info("[Updater] Dependências atualizadas")
            except Exception as e:
                self.logger.warning(f"[Updater] Erro ao atualizar dependências: {e}")

    def _reload_version_module(self, expected_version: str) -> None:
        """Reload agent.version so the Supervisor heartbeat reports the new version."""
        import importlib

        try:
            import agent.version
            importlib.reload(agent.version)
            new_ver = agent.version.get_version()
            self.logger.info(f"[Updater] Módulo agent.version recarregado: v{new_ver}")
        except Exception as e:
            self.logger.warning(f"[Updater] Falha ao recarregar agent.version: {e}")

        # Belt-and-suspenders: verify against disk
        disk_ver = self._get_disk_version()
        if disk_ver and disk_ver != expected_version:
            self.logger.warning(
                f"[Updater] Versão em disco ({disk_ver}) difere da esperada ({expected_version})"
            )

    def _get_disk_version(self) -> Optional[str]:
        """Read version directly from agent/version.py on disk, bypassing module cache."""
        version_file = self.install_dir / "agent" / "version.py"
        try:
            content = version_file.read_text()
            for line in content.splitlines():
                if line.startswith("__version__"):
                    return line.split("=")[1].strip().strip("\"'")
        except Exception as e:
            self.logger.warning(f"[Updater] Erro ao ler versão do disco: {e}")
        return None

    def _restore_backup(self) -> None:
        if self.backup_dir.exists():
            self.logger.info("[Updater] Restaurando backup...")
            shutil.rmtree(self.install_dir, ignore_errors=True)
            shutil.copytree(self.backup_dir, self.install_dir)
            self.logger.info("[Updater] Backup restaurado")
