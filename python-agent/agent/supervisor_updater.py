"""
SupervisorUpdater — Worker updates the Supervisor (cross-update).

The Worker process detects pending supervisor updates (written by the
Supervisor as a JSON file) and applies them:
1. Download the supervisor package
2. Validate checksum
3. Validate package structure (all critical files present)
4. Smoke test: attempt to compile/import supervisor.main
5. Replace supervisor/ directory on disk
6. Write a restart flag so the Supervisor exits and systemd restarts it
"""

import hashlib
import json
import os
import py_compile
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from typing import Optional


PENDING_FILE = Path("/var/lib/iscope-agent/pending_supervisor_update.json")
RESTART_FLAG = Path("/var/lib/iscope-agent/supervisor_restart.flag")
SUPERVISOR_DIR = Path("/opt/iscope-agent/supervisor")
BACKUP_DIR = Path("/var/lib/iscope-agent/supervisor_backup")

# Every file that supervisor/main.py imports from supervisor.*
REQUIRED_FILES = [
    "__init__.py",
    "main.py",
    "version.py",
    "config.py",
    "heartbeat.py",
    "updater.py",
    "monitor_updater.py",
    "worker_manager.py",
    "logger.py",
    "realtime_shell.py",
    "realtime_listener.py",
]

_VERSION_RE = re.compile(r'__version__\s*=\s*["\']([^"\']+)["\']')


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

            # 4. Find supervisor root inside extracted package
            sup_root = self._find_supervisor_root(extract_dir)
            if not sup_root:
                self.logger.error("[SupUpdater] Pacote não contém supervisor/ válido")
                self._log_extracted_contents(extract_dir)
                shutil.rmtree(extract_dir)
                return

            # 5. Validate all required files exist
            if not self._validate_required_files(sup_root):
                shutil.rmtree(extract_dir)
                return

            # 6. Read and log version from package
            pkg_version = self._read_package_version(sup_root)
            self.logger.info(f"[SupUpdater] Versão no pacote: {pkg_version or 'não detectada'}")

            # 7. Smoke test: compile all .py files and test import
            if not self._smoke_test(sup_root):
                self.logger.error("[SupUpdater] Smoke test FALHOU — update abortado, versão atual mantida")
                shutil.rmtree(extract_dir)
                return

            self.logger.info("[SupUpdater] Smoke test OK — prosseguindo com replace")

            # 8. Backup current supervisor/
            self._backup()

            # 9. Replace supervisor/ on disk
            self._replace(sup_root)
            shutil.rmtree(extract_dir)

            # 10. Write restart flag
            RESTART_FLAG.parent.mkdir(parents=True, exist_ok=True)
            RESTART_FLAG.write_text(version)
            self.logger.info(f"[SupUpdater] Supervisor v{version} instalado, restart flag escrita")

            # 11. Remove pending file
            PENDING_FILE.unlink(missing_ok=True)

        except Exception as e:
            self.logger.error(f"[SupUpdater] Erro durante update: {e}")
            self._restore_backup()

    # ------------------------------------------------------------------
    # Download / verify / extract
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
        self.logger.error(f"[SupUpdater] Checksum mismatch: esperado={exp} recebido={actual}")
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

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

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

    def _validate_required_files(self, sup_root: Path) -> bool:
        """Check that all critical supervisor module files exist."""
        missing = []
        for fname in REQUIRED_FILES:
            if not (sup_root / fname).exists():
                missing.append(fname)

        if missing:
            self.logger.error(
                f"[SupUpdater] Arquivos obrigatórios AUSENTES no pacote: {', '.join(missing)}"
            )
            found = [f.name for f in sup_root.iterdir() if f.is_file()]
            self.logger.error(f"[SupUpdater] Arquivos encontrados: {', '.join(sorted(found))}")
            return False

        self.logger.info(f"[SupUpdater] Todos {len(REQUIRED_FILES)} arquivos obrigatórios presentes")
        return True

    def _read_package_version(self, sup_root: Path) -> Optional[str]:
        """Read __version__ from version.py in the package."""
        version_file = sup_root / "version.py"
        try:
            content = version_file.read_text(encoding="utf-8")
            m = _VERSION_RE.search(content)
            if m:
                return m.group(1)
        except Exception:
            pass
        return None

    def _log_extracted_contents(self, extract_dir: str):
        """Log contents of extracted directory for debugging."""
        try:
            root = Path(extract_dir)
            items = []
            for p in sorted(root.rglob("*")):
                rel = p.relative_to(root)
                items.append(str(rel))
            self.logger.error(f"[SupUpdater] Conteúdo do pacote extraído: {items[:50]}")
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Smoke test
    # ------------------------------------------------------------------

    def _smoke_test(self, sup_root: Path) -> bool:
        """
        Validate the new supervisor code is bootable before replacing.

        1. Compile all .py files (catches syntax errors)
        2. Run a quick import test in a subprocess (catches import errors)
        """
        # Step 1: Compile all .py files
        py_files = list(sup_root.glob("*.py"))
        for py_file in py_files:
            try:
                py_compile.compile(str(py_file), doraise=True)
            except py_compile.PyCompileError as e:
                self.logger.error(f"[SupUpdater] Erro de sintaxe em {py_file.name}: {e}")
                return False

        self.logger.info(f"[SupUpdater] Compilação OK ({len(py_files)} arquivos .py)")

        # Step 2: Test import in isolated subprocess
        # We create a temp directory structure that mirrors the install dir
        # but with the NEW supervisor/ so we can test the import
        try:
            staging = tempfile.mkdtemp(prefix="iscope-sup-smoke-")
            staging_path = Path(staging)

            # Copy the new supervisor/ into staging
            shutil.copytree(sup_root, staging_path / "supervisor")

            # Symlink other required packages from install dir so imports resolve
            install_dir = SUPERVISOR_DIR.parent  # /opt/iscope-agent
            for dep_dir in ["agent", "monitor"]:
                src = install_dir / dep_dir
                if src.exists():
                    os.symlink(str(src), str(staging_path / dep_dir))

            # Run import test
            test_script = (
                "import sys; sys.path.insert(0, '{staging}'); "
                "from supervisor.version import get_version; "
                "from supervisor.config import API_BASE_URL; "
                "from supervisor.logger import setup_supervisor_logger; "
                "print('SMOKE_OK')"
            ).format(staging=staging)

            result = subprocess.run(
                [sys.executable, "-c", test_script],
                capture_output=True,
                text=True,
                timeout=30,
                env={**os.environ, "PYTHONPATH": staging},
            )

            shutil.rmtree(staging)

            if result.returncode == 0 and "SMOKE_OK" in result.stdout:
                self.logger.info("[SupUpdater] Import smoke test OK")
                return True
            else:
                self.logger.error(
                    f"[SupUpdater] Import smoke test FALHOU | "
                    f"exit={result.returncode} | "
                    f"stdout={result.stdout.strip()[:200]} | "
                    f"stderr={result.stderr.strip()[:500]}"
                )
                return False

        except Exception as e:
            self.logger.error(f"[SupUpdater] Erro no smoke test: {e}")
            # Clean up staging if it exists
            try:
                shutil.rmtree(staging)
            except Exception:
                pass
            return False

    # ------------------------------------------------------------------
    # Backup / replace / restore
    # ------------------------------------------------------------------

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
