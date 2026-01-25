import time


class AgentScheduler:
    """Scheduler with exponential backoff for error handling."""
    
    def __init__(self, initial_interval, task, logger):
        self.base_interval = initial_interval
        self.current_interval = initial_interval
        self.max_interval = 300  # 5 minutes maximum
        self.consecutive_errors = 0
        self.task = task
        self.logger = logger

    def start(self):
        self.logger.info(f"Scheduler iniciado (intervalo base: {self.base_interval}s, max: {self.max_interval}s)")

        while True:
            self.logger.info(f"Tick do scheduler (intervalo atual: {self.current_interval}s)")

            try:
                result = self.task()

                # Reset backoff on success
                if self.consecutive_errors > 0:
                    self.logger.info(f"Operação bem-sucedida após {self.consecutive_errors} erros consecutivos. Resetando backoff.")
                self.consecutive_errors = 0

                # Use server-provided interval if available, otherwise use base
                if isinstance(result, int) and result > 0:
                    self.current_interval = max(result, 10)
                else:
                    self.current_interval = self.base_interval

            except Exception:
                self.consecutive_errors += 1
                
                # Exponential backoff: base * 2^errors, capped at max_interval
                # Examples with base=120: 120 -> 240 -> 300 (capped)
                self.current_interval = min(
                    self.base_interval * (2 ** self.consecutive_errors),
                    self.max_interval
                )
                
                self.logger.exception(
                    f"Erro no loop principal (erro #{self.consecutive_errors}). "
                    f"Próximo intervalo: {self.current_interval}s"
                )

            self.logger.info(f"Dormindo por {self.current_interval}s")
            time.sleep(self.current_interval)
