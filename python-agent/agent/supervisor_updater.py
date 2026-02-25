"""
SupervisorUpdater — Worker updates the Supervisor (cross-update).

The Worker process detects pending supervisor updates (written by the
Supervisor as a JSON file) and applies them:
1. Download the supervisor package
2. Validate checksum
3. Replace supervisor/ directory on disk
4. Write a restart flag so the Supervisor exits and systemd restarts it
"""

import hashlib
import json
import os
import shutil
import tarfile
import tempfile
from pathlib import Path
from typing import Optional


PENDING_FILE = Path("/var/lib/iscope-agent/pending_supervisor_update.json")
RESTART_FLAG = Path("/var/lib/iscope-agent/supervisor_restart.flag")
SUPERVISOR_DIR = Path("/opt/iscope-agent/supervisor")
BACKUP_DIR = Path("/var/lib/iscope-agent/supervisor_backup")


class SupervisorUpdater:
    """Worker-side updater that replaces the Supervisor code on disk."""

    def __init__(self, logger):
        self.logger = logger

    def check_and_apply(self):
        """Check for a pending supervisor update and apply it if found."""
        if not PENDING_FILE.exists():
            return

        try:
            update_info = json.loads(PENDING_FILE.read_text())
        except Exception as e:
            self.logger.error(f"[SupUpdater] Erro ao ler pending file: {e}")
            PENDING_FILE.unlink(missing_ok=True)
            return

        version = update_info.get("version", "?")
        download_url = update_info.get("download_url")
        expected_checksum = update_info.get("checksum", "")

        if not download_url:
            self.logger.warning("[SupUpdater] URL de download ausente, ignorando")
            PENDING_FILE.unlink(missing_ok=True)
            return

        self.logger.info(f"[SupUpdater] Atualizando Supervisor para v{version}")

        try:
            # 1. Download
            tmp_file = self._download(download_url)
            if not tmp_file:
                return

            # 2. Checksum
            if expected_checksum and not self._verify_checksum(tmp_file, expected_checksum):
                os.remove(tmp_file)
                return

            # 3. Extract
            extract_dir = self._extract(tmp_file)
            os.remove(tmp_file)
            if not extract_dir:
                return

            # 4. Validate — must contain supervisor/ with __init__.py
            sup_root = self._find_supervisor_root(extract_dir)
            if not sup_root:
                self.logger.error("[SupUpdater] Pacote não contém supervisor/ válido")
                shutil.rmtree(extract_dir)
                return

            # 5. Backup current supervisor/
            self._backup()

            # 6. Replace supervisor/ on disk
            self._replace(sup_root)
            shutil.rmtree(extract_dir)

            # 7. Write restart flag
            RESTART_FLAG.parent.mkdir(parents=True, exist_ok=True)
            RESTART_FLAG.write_text(version)
            self.logger.info(f"[SupUpdater] Supervisor v{version} instalado, restart flag escrita")

            # 8. Remove pending file
            PENDING_FILE.unlink(missing_ok=True)

        except Exception as e:
            self.logger.error(f"[SupUpdater] Erro durante update: {e}")
            self._restore_backup()

    # ------------------------------------------------------------------

    def _download(self, url: str) -> Optional[str]:
        try:
            import requests
            self.logger.info(f"[SupUpdater] Baixando {url}")
            resp = requests.get(url, stream=True, timeout=120)
            resp.raise_for_status()
            tmp = tempfile.mktemp(suffix=".tar.gz")
            with open(tmp, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            return tmp
        except Exception as e:
            self.logger.error(f"[SupUpdater] Download falhou: {e}")
            return None

    def _verify_checksum(self, filepath: str, expected: str) -> bool:
        sha = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha.update(chunk)
        actual = sha.hexdigest()
        exp = expected[7:] if expected.startswith("sha256:") else expected
        if actual.lower() == exp.lower():
            self.logger.info("[SupUpdater] Checksum OK")
            return True
        self.logger.error(f"[SupUpdater] Checksum mismatch: {exp} vs {actual}")
        return False

    def _extract(self, filepath: str) -> Optional[str]:
        try:
            d = tempfile.mkdtemp(prefix="iscope-sup-update-")
            with tarfile.open(filepath, "r:gz") as tar:
                for m in tar.getmembers():
                    if m.name.startswith("/") or ".." in m.name:
                        raise ValueError(f"Path traversal: {m.name}")
                tar.extractall(d)
            return d
        except Exception as e:
            self.logger.error(f"[SupUpdater] Extração falhou: {e}")
            return None

    def _find_supervisor_root(self, extract_dir: str) -> Optional[Path]:
        """Find the supervisor/ directory inside the extracted package."""
        root = Path(extract_dir)
        # Direct: supervisor/__init__.py
        if (root / "supervisor" / "__init__.py").exists():
            return root / "supervisor"
        # One level deep (single subdirectory wrapper)
        subdirs = [d for d in root.iterdir() if d.is_dir()]
        if len(subdirs) == 1:
            candidate = subdirs[0] / "supervisor"
            if (candidate / "__init__.py").exists():
                return candidate
        return None

    def _backup(self):
        if BACKUP_DIR.exists():
            shutil.rmtree(BACKUP_DIR)
        if SUPERVISOR_DIR.exists():
            shutil.copytree(SUPERVISOR_DIR, BACKUP_DIR)
            self.logger.info(f"[SupUpdater] Backup em {BACKUP_DIR}")

    def _replace(self, new_sup: Path):
        if SUPERVISOR_DIR.exists():
            shutil.rmtree(SUPERVISOR_DIR)
        shutil.copytree(new_sup, SUPERVISOR_DIR)
        self.logger.info("[SupUpdater] supervisor/ substituído com sucesso")

    def _restore_backup(self):
        if BACKUP_DIR.exists():
            self.logger.info("[SupUpdater] Restaurando backup...")
            if SUPERVISOR_DIR.exists():
                shutil.rmtree(SUPERVISOR_DIR, ignore_errors=True)
            shutil.copytree(BACKUP_DIR, SUPERVISOR_DIR)
