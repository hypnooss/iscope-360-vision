"""
MetricsCollector — reads Linux /proc and os for server performance metrics.

Zero external dependencies. All reads are from /proc (Linux) and os.statvfs.
"""

import os
import platform
import socket
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple


class MetricsCollector:
    """Stateful collector that tracks deltas for CPU and network."""

    def __init__(self, disk_path: str = "/"):
        self._disk_path = disk_path
        self._prev_cpu: Optional[Tuple[float, float]] = None  # (idle, total)
        self._prev_net: Optional[Tuple[int, int, float]] = None  # (rx, tx, timestamp)

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def collect(self) -> Dict[str, Any]:
        """Return a dict with all metrics. Safe — never raises."""
        metrics: Dict[str, Any] = {}
        try:
            metrics.update(self._cpu())
        except Exception:
            pass
        try:
            metrics.update(self._memory())
        except Exception:
            pass
        try:
            metrics.update(self._disk())
        except Exception:
            pass
        try:
            metrics.update(self._network())
        except Exception:
            pass
        try:
            metrics.update(self._system())
        except Exception:
            pass
        return metrics

    # ------------------------------------------------------------------
    # CPU
    # ------------------------------------------------------------------

    def _cpu(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {}

        # cpu_count
        try:
            data["cpu_count"] = os.cpu_count() or 0
        except Exception:
            data["cpu_count"] = 0

        # load averages
        try:
            load = os.getloadavg()
            data["load_avg_1m"] = round(load[0], 2)
            data["load_avg_5m"] = round(load[1], 2)
            data["load_avg_15m"] = round(load[2], 2)
        except Exception:
            pass

        # cpu_percent from /proc/stat (delta between two reads)
        try:
            idle, total = self._read_cpu_times()
            if self._prev_cpu is not None:
                prev_idle, prev_total = self._prev_cpu
                diff_idle = idle - prev_idle
                diff_total = total - prev_total
                if diff_total > 0:
                    data["cpu_percent"] = round((1.0 - diff_idle / diff_total) * 100, 2)
            self._prev_cpu = (idle, total)
        except Exception:
            pass

        return data

    @staticmethod
    def _read_cpu_times() -> Tuple[float, float]:
        """Parse first 'cpu' line of /proc/stat → (idle, total)."""
        with open("/proc/stat", "r") as f:
            line = f.readline()  # cpu  user nice system idle iowait irq softirq ...
        parts = line.split()
        values = [float(v) for v in parts[1:]]
        idle = values[3] + (values[4] if len(values) > 4 else 0)  # idle + iowait
        total = sum(values)
        return idle, total

    # ------------------------------------------------------------------
    # Memory
    # ------------------------------------------------------------------

    @staticmethod
    def _memory() -> Dict[str, Any]:
        """Parse /proc/meminfo for RAM metrics."""
        info: Dict[str, int] = {}
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split()
                key = parts[0].rstrip(":")
                if key in ("MemTotal", "MemAvailable", "MemFree", "Buffers", "Cached"):
                    info[key] = int(parts[1])  # kB

        total_kb = info.get("MemTotal", 0)
        available_kb = info.get("MemAvailable", info.get("MemFree", 0))
        used_kb = total_kb - available_kb

        total_mb = total_kb // 1024
        used_mb = used_kb // 1024
        pct = round((used_kb / total_kb) * 100, 2) if total_kb > 0 else 0.0

        return {
            "ram_total_mb": total_mb,
            "ram_used_mb": used_mb,
            "ram_percent": pct,
        }

    # ------------------------------------------------------------------
    # Disk
    # ------------------------------------------------------------------

    # Pseudo-filesystems to skip when scanning partitions
    _SKIP_FS = frozenset({
        "tmpfs", "devtmpfs", "proc", "sysfs", "securityfs", "debugfs",
        "cgroup", "cgroup2", "pstore", "mqueue", "hugetlbfs", "devpts",
        "autofs", "binfmt_misc", "configfs", "fusectl", "tracefs",
        "overlay", "nsfs", "fuse.lxcfs", "efivarfs", "bpf", "ramfs",
    })

    def _disk(self) -> Dict[str, Any]:
        partitions = self._collect_partitions()
        data: Dict[str, Any] = {}

        # Keep legacy fields from "/" for backward compat
        root = next((p for p in partitions if p["path"] == self._disk_path), None)
        if root:
            data["disk_total_gb"] = root["total_gb"]
            data["disk_used_gb"] = root["used_gb"]
            data["disk_percent"] = root["percent"]
            data["disk_path"] = root["path"]
        elif partitions:
            p = partitions[0]
            data["disk_total_gb"] = p["total_gb"]
            data["disk_used_gb"] = p["used_gb"]
            data["disk_percent"] = p["percent"]
            data["disk_path"] = p["path"]

        if partitions:
            data["disk_partitions"] = partitions

        return data

    def _collect_partitions(self) -> list:
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
            # Fallback: just the configured path
            try:
                st = os.statvfs(self._disk_path)
                total = st.f_blocks * st.f_frsize
                free = st.f_bavail * st.f_frsize
                used = total - free
                partitions.append({
                    "path": self._disk_path,
                    "total_gb": round(total / (1024 ** 3), 2),
                    "used_gb": round(used / (1024 ** 3), 2),
                    "percent": round((used / total) * 100, 2) if total > 0 else 0.0,
                })
            except Exception:
                pass
        return partitions

    # ------------------------------------------------------------------
    # Network (delta bytes/s)
    # ------------------------------------------------------------------

    def _network(self) -> Dict[str, Any]:
        rx, tx = self._read_net_bytes()
        now = time.monotonic()
        data: Dict[str, Any] = {}

        if self._prev_net is not None:
            prev_rx, prev_tx, prev_t = self._prev_net
            elapsed = now - prev_t
            if elapsed > 0:
                data["net_bytes_recv"] = int((rx - prev_rx) / elapsed)
                data["net_bytes_sent"] = int((tx - prev_tx) / elapsed)

        self._prev_net = (rx, tx, now)
        return data

    @staticmethod
    def _read_net_bytes() -> Tuple[int, int]:
        """Sum rx/tx bytes from /proc/net/dev (skip loopback)."""
        total_rx = 0
        total_tx = 0
        with open("/proc/net/dev", "r") as f:
            for line in f:
                if ":" not in line:
                    continue
                iface, rest = line.split(":", 1)
                iface = iface.strip()
                if iface == "lo":
                    continue
                cols = rest.split()
                total_rx += int(cols[0])
                total_tx += int(cols[8])
        return total_rx, total_tx

    # ------------------------------------------------------------------
    # System
    # ------------------------------------------------------------------

    @staticmethod
    def _system() -> Dict[str, Any]:
        data: Dict[str, Any] = {}

        # Uptime
        try:
            with open("/proc/uptime", "r") as f:
                data["uptime_seconds"] = int(float(f.read().split()[0]))
        except Exception:
            pass

        # Hostname
        try:
            data["hostname"] = socket.gethostname()
        except Exception:
            pass

        # OS info
        try:
            uname = platform.uname()
            distro = ""
            os_release = Path("/etc/os-release")
            if os_release.exists():
                for line in os_release.read_text().splitlines():
                    if line.startswith("PRETTY_NAME="):
                        distro = line.split("=", 1)[1].strip('"')
                        break
            data["os_info"] = f"{distro} {uname.release}".strip()
        except Exception:
            pass

        # Process count
        try:
            data["process_count"] = len([
                d for d in os.listdir("/proc") if d.isdigit()
            ])
        except Exception:
            pass

        return data
