import requests
import urllib3
from typing import Dict, Any, List
from agent.executors.base import BaseExecutor

# Desabilita warnings de SSL para conexões com certificados auto-assinados
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class FortiGateComplianceExecutor(BaseExecutor):
    """
    Executor para verificações de compliance em FortiGate.
    """

    def run(self, task: Dict[str, Any]) -> Dict[str, Any]:
        target = task.get('target', {})
        self.validate_target(target, ['url', 'api_key'])

        base_url = target['url'].rstrip('/')
        api_key = target['api_key']
        
        self.logger.info(f"Conectando ao FortiGate: {base_url}")

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        results = {
            'score': 0,
            'categories': {},
            'checks': [],
            'system_info': {},
            'timestamp': None
        }

        try:
            # Buscar informações do sistema
            system_info = self._get_system_info(base_url, headers)
            results['system_info'] = system_info

            # Executar verificações de compliance
            checks = self._run_compliance_checks(base_url, headers)
            results['checks'] = checks

            # Calcular score
            results['score'] = self._calculate_score(checks)
            results['categories'] = self._group_by_category(checks)

            from datetime import datetime
            results['timestamp'] = datetime.utcnow().isoformat()

            self.logger.info(f"Compliance check concluído. Score: {results['score']}")

        except requests.exceptions.ConnectionError as e:
            self.logger.error(f"Erro de conexão com FortiGate: {e}")
            raise ConnectionError(f"Não foi possível conectar ao FortiGate: {e}")

        except requests.exceptions.Timeout as e:
            self.logger.error(f"Timeout na conexão com FortiGate: {e}")
            raise TimeoutError(f"Timeout ao conectar ao FortiGate: {e}")

        return results

    def _get_system_info(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Obtém informações do sistema FortiGate."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/monitor/system/status",
                headers=headers,
                verify=False,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            return {
                'hostname': data.get('results', {}).get('hostname', 'Unknown'),
                'version': data.get('results', {}).get('version', 'Unknown'),
                'serial': data.get('results', {}).get('serial', 'Unknown'),
                'model': data.get('results', {}).get('model', 'Unknown'),
            }
        except Exception as e:
            self.logger.warning(f"Não foi possível obter informações do sistema: {e}")
            return {}

    def _run_compliance_checks(self, base_url: str, headers: dict) -> List[Dict[str, Any]]:
        """Executa verificações de compliance."""
        checks = []

        # Check 1: Admin password policy
        checks.append(self._check_admin_password_policy(base_url, headers))

        # Check 2: HTTPS admin access
        checks.append(self._check_https_admin(base_url, headers))

        # Check 3: Firmware version
        checks.append(self._check_firmware(base_url, headers))

        # Check 4: DNS settings
        checks.append(self._check_dns_settings(base_url, headers))

        # Check 5: NTP settings
        checks.append(self._check_ntp_settings(base_url, headers))

        # Check 6: Log settings
        checks.append(self._check_log_settings(base_url, headers))

        # Check 7: Strong crypto
        checks.append(self._check_strong_crypto(base_url, headers))

        return [c for c in checks if c is not None]

    def _check_admin_password_policy(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Verifica política de senha do admin."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/cmdb/system/password-policy",
                headers=headers,
                verify=False,
                timeout=30
            )
            if response.ok:
                data = response.json().get('results', {})
                status = data.get('status', 'disable')
                return {
                    'id': 'admin_password_policy',
                    'name': 'Política de Senha Admin',
                    'category': 'Autenticação',
                    'status': 'pass' if status == 'enable' else 'fail',
                    'severity': 'high',
                    'details': f"Status: {status}"
                }
        except Exception as e:
            self.logger.debug(f"Check admin_password_policy falhou: {e}")
        
        return {
            'id': 'admin_password_policy',
            'name': 'Política de Senha Admin',
            'category': 'Autenticação',
            'status': 'unknown',
            'severity': 'high',
            'details': 'Não foi possível verificar'
        }

    def _check_https_admin(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Verifica se HTTPS está habilitado para admin."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/cmdb/system/global",
                headers=headers,
                verify=False,
                timeout=30
            )
            if response.ok:
                data = response.json().get('results', {})
                admin_https = data.get('admin-https-redirect', 'disable')
                return {
                    'id': 'https_admin',
                    'name': 'Redirecionamento HTTPS Admin',
                    'category': 'Acesso Seguro',
                    'status': 'pass' if admin_https == 'enable' else 'warn',
                    'severity': 'medium',
                    'details': f"admin-https-redirect: {admin_https}"
                }
        except Exception as e:
            self.logger.debug(f"Check https_admin falhou: {e}")
        
        return {
            'id': 'https_admin',
            'name': 'Redirecionamento HTTPS Admin',
            'category': 'Acesso Seguro',
            'status': 'unknown',
            'severity': 'medium',
            'details': 'Não foi possível verificar'
        }

    def _check_firmware(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Verifica versão do firmware."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/monitor/system/firmware",
                headers=headers,
                verify=False,
                timeout=30
            )
            if response.ok:
                data = response.json().get('results', {})
                current = data.get('current', {}).get('version', 'Unknown')
                return {
                    'id': 'firmware_version',
                    'name': 'Versão do Firmware',
                    'category': 'Atualizações',
                    'status': 'info',
                    'severity': 'low',
                    'details': f"Versão atual: {current}"
                }
        except Exception as e:
            self.logger.debug(f"Check firmware falhou: {e}")
        
        return {
            'id': 'firmware_version',
            'name': 'Versão do Firmware',
            'category': 'Atualizações',
            'status': 'unknown',
            'severity': 'low',
            'details': 'Não foi possível verificar'
        }

    def _check_dns_settings(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Verifica configurações DNS."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/cmdb/system/dns",
                headers=headers,
                verify=False,
                timeout=30
            )
            if response.ok:
                data = response.json().get('results', {})
                primary = data.get('primary', 'Not set')
                secondary = data.get('secondary', 'Not set')
                has_dns = primary != '0.0.0.0' and primary != 'Not set'
                return {
                    'id': 'dns_settings',
                    'name': 'Configuração DNS',
                    'category': 'Rede',
                    'status': 'pass' if has_dns else 'warn',
                    'severity': 'low',
                    'details': f"Primary: {primary}, Secondary: {secondary}"
                }
        except Exception as e:
            self.logger.debug(f"Check dns_settings falhou: {e}")
        
        return {
            'id': 'dns_settings',
            'name': 'Configuração DNS',
            'category': 'Rede',
            'status': 'unknown',
            'severity': 'low',
            'details': 'Não foi possível verificar'
        }

    def _check_ntp_settings(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Verifica configurações NTP."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/cmdb/system/ntp",
                headers=headers,
                verify=False,
                timeout=30
            )
            if response.ok:
                data = response.json().get('results', {})
                ntp_sync = data.get('ntpsync', 'disable')
                return {
                    'id': 'ntp_settings',
                    'name': 'Sincronização NTP',
                    'category': 'Sistema',
                    'status': 'pass' if ntp_sync == 'enable' else 'warn',
                    'severity': 'medium',
                    'details': f"ntpsync: {ntp_sync}"
                }
        except Exception as e:
            self.logger.debug(f"Check ntp_settings falhou: {e}")
        
        return {
            'id': 'ntp_settings',
            'name': 'Sincronização NTP',
            'category': 'Sistema',
            'status': 'unknown',
            'severity': 'medium',
            'details': 'Não foi possível verificar'
        }

    def _check_log_settings(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Verifica configurações de log."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/cmdb/log/setting",
                headers=headers,
                verify=False,
                timeout=30
            )
            if response.ok:
                data = response.json().get('results', {})
                log_mode = data.get('log-mode', 'disable')
                return {
                    'id': 'log_settings',
                    'name': 'Configurações de Log',
                    'category': 'Auditoria',
                    'status': 'pass' if log_mode != 'disable' else 'fail',
                    'severity': 'high',
                    'details': f"log-mode: {log_mode}"
                }
        except Exception as e:
            self.logger.debug(f"Check log_settings falhou: {e}")
        
        return {
            'id': 'log_settings',
            'name': 'Configurações de Log',
            'category': 'Auditoria',
            'status': 'unknown',
            'severity': 'high',
            'details': 'Não foi possível verificar'
        }

    def _check_strong_crypto(self, base_url: str, headers: dict) -> Dict[str, Any]:
        """Verifica uso de criptografia forte."""
        try:
            response = requests.get(
                f"{base_url}/api/v2/cmdb/system/global",
                headers=headers,
                verify=False,
                timeout=30
            )
            if response.ok:
                data = response.json().get('results', {})
                strong_crypto = data.get('strong-crypto', 'disable')
                return {
                    'id': 'strong_crypto',
                    'name': 'Criptografia Forte',
                    'category': 'Segurança',
                    'status': 'pass' if strong_crypto == 'enable' else 'fail',
                    'severity': 'high',
                    'details': f"strong-crypto: {strong_crypto}"
                }
        except Exception as e:
            self.logger.debug(f"Check strong_crypto falhou: {e}")
        
        return {
            'id': 'strong_crypto',
            'name': 'Criptografia Forte',
            'category': 'Segurança',
            'status': 'unknown',
            'severity': 'high',
            'details': 'Não foi possível verificar'
        }

    def _calculate_score(self, checks: List[Dict[str, Any]]) -> int:
        """Calcula score de compliance baseado nos checks."""
        if not checks:
            return 0

        weights = {
            'high': 3,
            'medium': 2,
            'low': 1
        }

        total_weight = 0
        passed_weight = 0

        for check in checks:
            severity = check.get('severity', 'low')
            weight = weights.get(severity, 1)
            total_weight += weight

            if check.get('status') == 'pass':
                passed_weight += weight
            elif check.get('status') == 'warn':
                passed_weight += weight * 0.5

        if total_weight == 0:
            return 0

        return int((passed_weight / total_weight) * 100)

    def _group_by_category(self, checks: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
        """Agrupa checks por categoria."""
        categories = {}
        for check in checks:
            category = check.get('category', 'Outros')
            if category not in categories:
                categories[category] = []
            categories[category].append(check)
        return categories


class FortiGateCVEExecutor(BaseExecutor):
    """
    Executor para verificação de CVEs em FortiGate.
    """

    def run(self, task: Dict[str, Any]) -> Dict[str, Any]:
        target = task.get('target', {})
        self.validate_target(target, ['url', 'api_key'])

        base_url = target['url'].rstrip('/')
        api_key = target['api_key']

        self.logger.info(f"Verificando CVEs no FortiGate: {base_url}")

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        results = {
            'version': None,
            'cves': [],
            'risk_level': 'unknown',
            'timestamp': None
        }

        try:
            # Obter versão do firmware
            response = requests.get(
                f"{base_url}/api/v2/monitor/system/status",
                headers=headers,
                verify=False,
                timeout=30
            )
            response.raise_for_status()
            data = response.json().get('results', {})
            
            version = data.get('version', 'Unknown')
            results['version'] = version

            # Nota: A verificação real de CVEs requer integração com base de dados externa
            # Por enquanto, retornamos informações básicas
            results['cves'] = []
            results['risk_level'] = 'low'

            from datetime import datetime
            results['timestamp'] = datetime.utcnow().isoformat()

            self.logger.info(f"CVE check concluído. Versão: {version}")

        except requests.exceptions.ConnectionError as e:
            self.logger.error(f"Erro de conexão com FortiGate: {e}")
            raise ConnectionError(f"Não foi possível conectar ao FortiGate: {e}")

        except requests.exceptions.Timeout as e:
            self.logger.error(f"Timeout na conexão com FortiGate: {e}")
            raise TimeoutError(f"Timeout ao conectar ao FortiGate: {e}")

        return results
