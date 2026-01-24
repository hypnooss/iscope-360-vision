from typing import Dict, Any, List
from agent.executors.base import BaseExecutor

try:
    import paramiko
    HAS_PARAMIKO = True
except ImportError:
    HAS_PARAMIKO = False


class SSHExecutor(BaseExecutor):
    """
    Executor para comandos SSH em dispositivos de rede.
    """

    def run(self, task: Dict[str, Any]) -> Dict[str, Any]:
        if not HAS_PARAMIKO:
            raise ImportError("Biblioteca 'paramiko' não instalada. Execute: pip install paramiko")

        target = task.get('target', {})
        payload = task.get('payload', {})

        self.validate_target(target, ['host', 'username', 'password'])

        host = target['host']
        port = target.get('port', 22)
        username = target['username']
        password = target['password']
        commands = payload.get('commands', [])

        if not commands:
            raise ValueError("Nenhum comando especificado no payload.commands")

        self.logger.info(f"Conectando via SSH: {username}@{host}:{port}")

        results = {
            'host': host,
            'outputs': [],
            'success': True,
            'timestamp': None
        }

        client = None
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            client.connect(
                hostname=host,
                port=port,
                username=username,
                password=password,
                timeout=30,
                allow_agent=False,
                look_for_keys=False
            )

            self.logger.info(f"Conectado a {host}. Executando {len(commands)} comandos...")

            for cmd in commands:
                output = self._execute_command(client, cmd)
                results['outputs'].append(output)

                if output.get('exit_code', 0) != 0:
                    results['success'] = False

            from datetime import datetime
            results['timestamp'] = datetime.utcnow().isoformat()

            self.logger.info(f"SSH concluído. {len(commands)} comandos executados.")

        except paramiko.AuthenticationException as e:
            self.logger.error(f"Falha de autenticação SSH: {e}")
            raise ValueError(f"Falha de autenticação SSH: {e}")

        except paramiko.SSHException as e:
            self.logger.error(f"Erro SSH: {e}")
            raise ConnectionError(f"Erro SSH: {e}")

        except Exception as e:
            self.logger.error(f"Erro ao conectar via SSH: {e}")
            raise

        finally:
            if client:
                client.close()

        return results

    def _execute_command(self, client: 'paramiko.SSHClient', command: str) -> Dict[str, Any]:
        """Executa um único comando e retorna o resultado."""
        try:
            stdin, stdout, stderr = client.exec_command(command, timeout=60)
            
            exit_code = stdout.channel.recv_exit_status()
            stdout_text = stdout.read().decode('utf-8', errors='replace')
            stderr_text = stderr.read().decode('utf-8', errors='replace')

            return {
                'command': command,
                'stdout': stdout_text,
                'stderr': stderr_text,
                'exit_code': exit_code
            }

        except Exception as e:
            self.logger.warning(f"Erro ao executar comando '{command}': {e}")
            return {
                'command': command,
                'stdout': '',
                'stderr': str(e),
                'exit_code': -1
            }
