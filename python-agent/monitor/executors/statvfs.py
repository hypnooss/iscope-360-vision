"""
StatvfsExecutor — collects disk metrics via /proc/mounts and os.statvfs().

Params:
  scan_mounts: bool — scan /proc/mounts for all real partitions (default true)
  disk_path: str — fallback path when scan_mounts is false (default "/")
"""

import os
from typing import Dict, Any

from monitor.executors.base import MonitorExecutor


class StatvfsExecutor(MonitorExecutor):
    """Collects disk partition metrics."""

    _SKIP_FS = frozenset({
        "tmpfs", "devtmpfs", "proc", "sysfs", "securityfs", "debugfs",
        "cgroup", "cgroup2", "pstore", "mqueue", "hugetlbfs", "devpts",
        "autofs", "binfmt_misc", "configfs", "fusectl", "tracefs",
        "overlay", "nsfs", "fuse.lxcfs", "efivarfs", "bpf", "ramfs",
    })

    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        scan_mounts = params.get("scan_mounts", True)
        disk_path = params.get("disk_path", "/")

        if scan_mounts:
            partitions = self._scan_partitions()
        else:
            partitions = self._single_path(disk_path)

        if not partitions:
            return {}

        data: Dict[str, Any] = {}

        # Legacy fields: use "/" partition or first available
        root = next((p for p in partitions if p["path"] == "/"), None)
        primary = root or partitions[0]
        data["disk_total_gb"] = primary["total_gb"]
        data["disk_used_gb"] = primary["used_gb"]
        data["disk_percent"] = primary["percent"]
        data["disk_path"] = primary["path"]
        data["disk_partitions"] = partitions

        return data

    def _scan_partitions(self) -> list:
        """Scan /proc/mounts for real partitions and collect metrics."""
        seen_devs: set = set()
        partitions: list = []
        try:
            with open("/proc/mounts", "r") as f:
                for line in f:
                    parts = line.split()
                    if len(parts) < 3:
                        continue
                    dev, mount, fstype = parts[0], parts[1], parts[2]
                    if fstype in self._SKIP_FS:
                        continue
                    if not dev.startswith("/dev/"):
                        continue
                    if dev in seen_devs:
                        continue
                    seen_devs.add(dev)
                    try:
                        st = os.statvfs(mount)
                        total = st.f_blocks * st.f_frsize
                        free = st.f_bavail * st.f_frsize
                        used = total - free
                        if total == 0:
                            continue
                        partitions.append({
                            "path": mount,
                            "total_gb": round(total / (1024 ** 3), 2),
                            "used_gb": round(used / (1024 ** 3), 2),
                            "percent": round((used / total) * 100, 2),
                        })
                    except Exception:
                        continue
        except Exception:
            return self._single_path("/")
        return partitions

    @staticmethod
    def _single_path(path: str) -> list:
        """Collect metrics for a single path."""
        try:
            st = os.statvfs(path)
            total = st.f_blocks * st.f_frsize
            free = st.f_bavail * st.f_frsize
            used = total - free
            return [{
                "path": path,
                "total_gb": round(total / (1024 ** 3), 2),
                "used_gb": round(used / (1024 ** 3), 2),
                "percent": round((used / total) * 100, 2) if total > 0 else 0.0,
            }]
        except Exception:
            return []
