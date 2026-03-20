"""
Base class for monitor executors.

Each executor receives step params and returns a dict of metrics.
Executors may be stateful (e.g. tracking deltas between calls).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class MonitorExecutor(ABC):
    """Base class for all monitor step executors."""

    @abstractmethod
    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a collection step with the given params.

        Args:
            params: Step parameters from the blueprint (e.g. {"parser": "cpu"})

        Returns:
            Dict with collected metrics to merge into the final payload.
        """
        pass
