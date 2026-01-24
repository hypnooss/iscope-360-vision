from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseExecutor(ABC):
    """
    Classe base para todos os executores de tarefas.
    """

    def __init__(self, logger):
        self.logger = logger

    @abstractmethod
    def run(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executa a tarefa e retorna o resultado.
        
        Args:
            task: Dicionário contendo:
                - id: ID da tarefa
                - type: Tipo da tarefa
                - target: Informações do alvo (url, credenciais, etc)
                - payload: Dados adicionais para execução
                - priority: Prioridade
                - expires_at: Data de expiração
        
        Returns:
            Dicionário com o resultado da execução.
            Estrutura depende do tipo de tarefa.
        
        Raises:
            TimeoutError: Se a execução exceder o tempo limite
            Exception: Para outros erros de execução
        """
        pass

    def validate_target(self, target: Dict[str, Any], required_fields: list) -> None:
        """
        Valida se o target contém os campos obrigatórios.
        
        Raises:
            ValueError: Se algum campo obrigatório estiver faltando
        """
        missing = [f for f in required_fields if not target.get(f)]
        if missing:
            raise ValueError(f"Campos obrigatórios faltando no target: {', '.join(missing)}")
