"""
ProcReadExecutor — reads /proc files and applies named parsers.

Supports parsers: cpu, memory, net_interfaces, system.
Maintains state for delta-based metrics (CPU usage, network rates).
"""

import os
import platform
import socket
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

from monitor.executors.base import MonitorExecutor


class ProcReadExecutor(MonitorExecutor):
    """Reads /proc files and parses metrics. Stateful for deltas."""

    def __init__(self):
        self._prev_cpu: Optional[Tuple[float, float]] = None
        self._prev_net: Optional[Dict[str, Tuple[int, int, float]]] = None

    # Parser registry
    _PARSERS = {
        "cpu": "_parse_cpu",
        "memory": "_parse_memory",
        "net_interfaces": "_parse_net_interfaces",
        "system": "_parse_system",
    }

    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        parser_name = params.get("parser")
        if not parser_name:
            return {}

        method_name = self._PARSERS.get(parser_name)
        if not method_name:
            return {}

        try:
            return getattr(self, method_name)(params)
        except Exception:
            return {}

    # ------------------------------------------------------------------
    # CPU parser
    # ------------------------------------------------------------------

    def _parse_cpu(self, params: Dict[str, Any]) -> Dict[str, Any]:
        data: Dict[str, Any] = {}

        try:
            data["cpu_count"] = os.cpu_count() or 0
        except Exception:
            data["cpu_count"] = 0

        try:
            load = os.getloadavg()
            data["load_avg_1m"] = round(load[0], 2)
            data["load_avg_5m"] = round(load[1], 2)
            data["load_avg_15m"] = round(load[2], 2)
        except Exception:
            pass

        try:
            idle, total = self._read_cpu_times()
            if self._prev_cpu is not None:
                prev_idle, prev_total = self._prev_cpu
                diff_idle = idle - prev_idle
                diff_total = total - prev_total
                if diff_total > 0:
                    data["cpu_percent"] = round(
                        (1.0 - diff_idle / diff_total) * 100, 2
                    )
            self._prev_cpu = (idle, total)
        except Exception:
            pass

        return data

    @staticmethod
    def _read_cpu_times() -> Tuple[float, float]:
        """Parse first 'cpu' line of /proc/stat → (idle, total)."""
        with open("/proc/stat", "r") as f:
            line = f.readline()
        parts = line.split()
        values = [float(v) for v in parts[1:]]
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        total = sum(values)
        return idle, total

    # ------------------------------------------------------------------
    # Memory parser
    # ------------------------------------------------------------------

    def _parse_memory(self, params: Dict[str, Any]) -> Dict[str, Any]:
        info: Dict[str, int] = {}
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split()
                key = parts[0].rstrip(":")
                if key in ("MemTotal", "MemAvailable", "MemFree", "Buffers", "Cached"):
                    info[key] = int(parts[1])

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
    # Network parser (per-interface delta bytes/s)
    # ------------------------------------------------------------------

    def _parse_net_interfaces(self, params: Dict[str, Any]) -> Dict[str, Any]:
        iface_counters = self._read_net_bytes_per_iface()
        now = time.monotonic()
        data: Dict[str, Any] = {}

        net_interfaces: List[Dict[str, Any]] = []
        total_sent = 0
        total_recv = 0

        if self._prev_net is not None:
            for iface, (rx, tx) in iface_counters.items():
                prev = self._prev_net.get(iface)
                if prev is None:
                    continue
                prev_rx, prev_tx, prev_t = prev
                elapsed = now - prev_t
                if elapsed <= 0:
                    continue

                rx_delta = rx - prev_rx
                tx_delta = tx - prev_tx
                if rx_delta < 0 or tx_delta < 0:
                    continue

                bytes_recv = int(rx_delta / elapsed)
                bytes_sent = int(tx_delta / elapsed)

                net_interfaces.append({
                    "iface": iface,
                    "bytes_sent": bytes_sent,
                    "bytes_recv": bytes_recv,
                })
                total_sent += bytes_sent
                total_recv += bytes_recv

        self._prev_net = {
            iface: (rx, tx, now) for iface, (rx, tx) in iface_counters.items()
        }

        if net_interfaces:
            data["net_interfaces"] = net_interfaces
            data["net_bytes_sent"] = total_sent
            data["net_bytes_recv"] = total_recv

        return data

    @staticmethod
    def _read_net_bytes_per_iface() -> Dict[str, Tuple[int, int]]:
        """Read rx/tx bytes per interface from /proc/net/dev (skip loopback)."""
        result: Dict[str, Tuple[int, int]] = {}
        with open("/proc/net/dev", "r") as f:
            for line in f:
                if ":" not in line:
                    continue
                iface, rest = line.split(":", 1)
                iface = iface.strip()
                if iface == "lo":
                    continue
                cols = rest.split()
                result[iface] = (int(cols[0]), int(cols[8]))
        return result

    # ------------------------------------------------------------------
    # System parser
    # ------------------------------------------------------------------

    def _parse_system(self, params: Dict[str, Any]) -> Dict[str, Any]:
        data: Dict[str, Any] = {}

        try:
            with open("/proc/uptime", "r") as f:
                data["uptime_seconds"] = int(float(f.read().split()[0]))
        except Exception:
            pass

        try:
            data["hostname"] = socket.gethostname()
        except Exception:
            pass

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

        try:
            data["process_count"] = len([
                d for d in os.listdir("/proc") if d.isdigit()
            ])
        except Exception:
            pass

        return data
