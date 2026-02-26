import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_supervisor_logger():
    """Logger dedicado do Supervisor. Arquivo via SUPERVISOR_LOG_FILE."""

    logger = logging.getLogger("iscope-supervisor")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    if not logger.handlers:
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

        log_file = os.getenv("SUPERVISOR_LOG_FILE")
        if log_file:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = RotatingFileHandler(
                str(log_path),
                maxBytes=1 * 1024 * 1024,
                backupCount=1,
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

    return logger
