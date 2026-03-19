"""
Monitor Updater — handles downloading and applying Monitor module updates.

Follows the same pattern as SupervisorUpdater but targets the monitor/ directory.
Runs inside the Supervisor process.
"""

import hashlib
import os
import shutil
import tarfile
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional


class MonitorUpdater:
    """Downloads, validates, and replaces the monitor/ module."""

    def __init__(self, logger, install_dir: Path):
        self.logger = logger
        self.install_dir = install_dir
        self.monitor_dir = install_dir / "monitor"
        self.backup_dir = Path("/var/lib/iscope-agent/backup_monitor")

    def check_and_update(self, update_info: Dict[str, Any], monitor_worker) -> bool:
        """
        Download, validate, and apply a monitor update.

        Args:
            update_info: Dict with version, download_url, checksum
            monitor_worker: MonitorWorker instance to stop/start

        Returns:
            True if update succeeded
        """
        version = update_info.get("version")
        download_url = update_info.get("download_url")
        expected_checksum = update_info.get("checksum", "")

        if not version or not download_url:
            self.logger.warning("[MonitorUpdater] Info de update incompleta, ignorando")
            return False

        self.logger.info(f"[MonitorUpdater] Iniciando atualização do Monitor para v{version}")

        try:
            # 1. Download
            tmp_file = self._download_package(download_url)
            if not tmp_file:
                return False

            # 2. Verify checksum
            if expected_checksum and not self._verify_checksum(tmp_file, expected_checksum):
                self.logger.error("[MonitorUpdater] Checksum inválido, abortando")
                os.remove(tmp_file)
                return False

            # 3. Extract
            extract_dir = self._extract_package(tmp_file)
            os.remove(tmp_file)
            if not extract_dir:
                return False

            # 4. Validate (must have monitor/ with __init__.py)
            root = self._find_monitor_root(extract_dir)
            if not root:
                self.logger.error("[MonitorUpdater] Pacote inválido: monitor/ não encontrado")
                shutil.rmtree(extract_dir)
                return False

            # 5. Stop monitor
            self.logger.info("[MonitorUpdater] Parando MonitorWorker...")
            monitor_worker.stop()

            # 6. Backup current monitor/
            self._backup_current()

            # 7. Replace monitor/ directory
            self._replace_monitor(root)
            shutil.rmtree(extract_dir)

            self.logger.info(f"[MonitorUpdater] Monitor atualizado para v{version}")

            # 8. Restart monitor
            monitor_worker.start()

            return True

        except Exception as e:
            self.logger.error(f"[MonitorUpdater] Erro durante update: {e}")
            self._restore_backup()
            try:
                monitor_worker.start()
            except Exception:
                pass
            return False

    def _download_package(self, url: str) -> Optional[str]:
        try:
            import requests
            self.logger.info(f"[MonitorUpdater] Baixando pacote de {url}")
            response = requests.get(url, stream=True, timeout=120)
            response.raise_for_status()
            tmp_file = tempfile.mktemp(suffix=".tar.gz")
            with open(tmp_file, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return tmp_file
        except Exception as e:
            self.logger.error(f"[MonitorUpdater] Erro no download: {e}")
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
            self.logger.info("[MonitorUpdater] Checksum OK")
            return True
        self.logger.error(f"[MonitorUpdater] Checksum mismatch: esperado {expected}, recebido {actual}")
        return False

    def _extract_package(self, filepath: str) -> Optional[str]:
        try:
            extract_dir = tempfile.mkdtemp(prefix="iscope-monitor-update-")
            with tarfile.open(filepath, "r:gz") as tar:
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in member.name:
                        raise ValueError(f"Path traversal detected: {member.name}")
                tar.extractall(extract_dir)
            return extract_dir
        except Exception as e:
            self.logger.error(f"[MonitorUpdater] Erro na extração: {e}")
            return None

    def _find_monitor_root(self, extract_dir: str) -> Optional[Path]:
        """Find the monitor/ directory inside the extracted package."""
        root = Path(extract_dir)
        # Direct: extract_dir/monitor/__init__.py
        if (root / "monitor" / "__init__.py").exists():
            return root / "monitor"
        # Nested: extract_dir/<subdir>/monitor/__init__.py
        for subdir in root.iterdir():
            if subdir.is_dir() and (subdir / "monitor" / "__init__.py").exists():
                return subdir / "monitor"
        return None

    def _backup_current(self) -> None:
        if self.backup_dir.exists():
            shutil.rmtree(self.backup_dir)
        if self.monitor_dir.exists():
            shutil.copytree(self.monitor_dir, self.backup_dir)
            self.logger.info(f"[MonitorUpdater] Backup criado em {self.backup_dir}")

    def _replace_monitor(self, new_monitor: Path) -> None:
        if self.monitor_dir.exists():
            shutil.rmtree(self.monitor_dir)
        shutil.copytree(new_monitor, self.monitor_dir)
        self.logger.info("[MonitorUpdater] monitor/ substituído com sucesso")

    def _restore_backup(self) -> None:
        if self.backup_dir.exists():
            self.logger.info("[MonitorUpdater] Restaurando backup...")
            if self.monitor_dir.exists():
                shutil.rmtree(self.monitor_dir)
            shutil.copytree(self.backup_dir, self.monitor_dir)
            self.logger.info("[MonitorUpdater] Backup restaurado")
