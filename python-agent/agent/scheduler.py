import time


class AgentScheduler:
    def __init__(self, initial_interval, task, logger):
        self.interval = initial_interval
        self.task = task
        self.logger = logger

    def start(self):
        self.logger.info("Scheduler iniciado")

        next_interval = self.interval

        while True:
            self.logger.info("Tick do scheduler")

            try:
                result = self.task()

                if isinstance(result, int) and result > 0:
                    next_interval = max(result, 10)

            except Exception:
                self.logger.exception("Erro no loop principal do agent")

            self.logger.info(f"Dormindo por {next_interval}s")
            time.sleep(next_interval)
