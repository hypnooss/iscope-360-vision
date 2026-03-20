"""
Monitor executors — registry of step executors for blueprint-driven collection.

Each executor handles a specific 'type' from the blueprint steps.
"""

from monitor.executors.proc_read import ProcReadExecutor
from monitor.executors.statvfs import StatvfsExecutor


# Registry: step "type" → executor class
EXECUTOR_REGISTRY = {
    "proc_read": ProcReadExecutor,
    "statvfs": StatvfsExecutor,
}


def get_executor(step_type: str):
    """Return an executor class for the given step type, or None."""
    return EXECUTOR_REGISTRY.get(step_type)
