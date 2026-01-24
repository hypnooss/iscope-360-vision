from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseExecutor(ABC):
    """
    Base class for all task executors.
    Now receives step configuration and context instead of full task.
    """

    def __init__(self, logger):
        self.logger = logger

    @abstractmethod
    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a step with the given context.
        
        Args:
            step: Step configuration from blueprint
            context: Execution context with credentials and target info
        
        Returns:
            Dict with data and/or error
        """
        pass