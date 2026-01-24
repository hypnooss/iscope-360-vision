from typing import Dict, Any, List
from agent.executors.base import BaseExecutor

try:
    from pysnmp.hlapi import (
        getCmd, nextCmd, bulkCmd,
        SnmpEngine, CommunityData, UdpTransportTarget,
        ContextData, ObjectType, ObjectIdentity
    )
    HAS_PYSNMP = True
except ImportError:
    HAS_PYSNMP = False


class SNMPExecutor(BaseExecutor):
    """
    Executor para queries SNMP em dispositivos de rede.
    """

    # OIDs comuns para dispositivos de rede
    COMMON_OIDS = {
        'sysDescr': '1.3.6.1.2.1.1.1.0',
        'sysObjectID': '1.3.6.1.2.1.1.2.0',
        'sysUpTime': '1.3.6.1.2.1.1.3.0',
        'sysContact': '1.3.6.1.2.1.1.4.0',
        'sysName': '1.3.6.1.2.1.1.5.0',
        'sysLocation': '1.3.6.1.2.1.1.6.0',
        'ifNumber': '1.3.6.1.2.1.2.1.0',
    }

    def run(self, task: Dict[str, Any]) -> Dict[str, Any]:
        if not HAS_PYSNMP:
            raise ImportError("Biblioteca 'pysnmp' não instalada. Execute: pip install pysnmp")

        target = task.get('target', {})
        payload = task.get('payload', {})

        self.validate_target(target, ['host', 'community'])

        host = target['host']
        port = target.get('port', 161)
        community = target['community']
        version = target.get('version', '2c')  # v1, v2c, v3

        # OIDs a consultar - pode vir do payload ou usar os comuns
        oids = payload.get('oids', list(self.COMMON_OIDS.values()))
        operation = payload.get('operation', 'get')  # get, walk, bulk

        self.logger.info(f"Conectando via SNMP: {host}:{port} (v{version})")

        results = {
            'host': host,
            'version': version,
            'data': {},
            'success': True,
            'timestamp': None
        }

        try:
            if operation == 'get':
                results['data'] = self._snmp_get(host, port, community, oids)
            elif operation == 'walk':
                results['data'] = self._snmp_walk(host, port, community, oids)
            elif operation == 'bulk':
                results['data'] = self._snmp_bulk(host, port, community, oids)
            else:
                raise ValueError(f"Operação SNMP desconhecida: {operation}")

            from datetime import datetime
            results['timestamp'] = datetime.utcnow().isoformat()

            self.logger.info(f"SNMP query concluída. {len(results['data'])} valores obtidos.")

        except Exception as e:
            self.logger.error(f"Erro SNMP: {e}")
            results['success'] = False
            results['error'] = str(e)
            raise

        return results

    def _snmp_get(self, host: str, port: int, community: str, oids: List[str]) -> Dict[str, str]:
        """Executa SNMP GET para os OIDs especificados."""
        data = {}

        for oid in oids:
            iterator = getCmd(
                SnmpEngine(),
                CommunityData(community),
                UdpTransportTarget((host, port), timeout=10, retries=3),
                ContextData(),
                ObjectType(ObjectIdentity(oid))
            )

            errorIndication, errorStatus, errorIndex, varBinds = next(iterator)

            if errorIndication:
                self.logger.warning(f"SNMP error for {oid}: {errorIndication}")
                data[oid] = f"Error: {errorIndication}"
            elif errorStatus:
                self.logger.warning(f"SNMP error for {oid}: {errorStatus.prettyPrint()}")
                data[oid] = f"Error: {errorStatus.prettyPrint()}"
            else:
                for varBind in varBinds:
                    oid_str = str(varBind[0])
                    value_str = str(varBind[1])
                    data[oid_str] = value_str

        return data

    def _snmp_walk(self, host: str, port: int, community: str, oids: List[str]) -> Dict[str, str]:
        """Executa SNMP WALK para os OIDs especificados."""
        data = {}

        for base_oid in oids:
            for errorIndication, errorStatus, errorIndex, varBinds in nextCmd(
                SnmpEngine(),
                CommunityData(community),
                UdpTransportTarget((host, port), timeout=10, retries=3),
                ContextData(),
                ObjectType(ObjectIdentity(base_oid)),
                lexicographicMode=False
            ):
                if errorIndication:
                    self.logger.warning(f"SNMP walk error: {errorIndication}")
                    break
                elif errorStatus:
                    self.logger.warning(f"SNMP walk error: {errorStatus.prettyPrint()}")
                    break
                else:
                    for varBind in varBinds:
                        oid_str = str(varBind[0])
                        value_str = str(varBind[1])
                        data[oid_str] = value_str

        return data

    def _snmp_bulk(self, host: str, port: int, community: str, oids: List[str]) -> Dict[str, str]:
        """Executa SNMP BULK GET para os OIDs especificados."""
        data = {}

        object_types = [ObjectType(ObjectIdentity(oid)) for oid in oids]

        for errorIndication, errorStatus, errorIndex, varBinds in bulkCmd(
            SnmpEngine(),
            CommunityData(community),
            UdpTransportTarget((host, port), timeout=10, retries=3),
            ContextData(),
            0, 25,  # nonRepeaters, maxRepetitions
            *object_types,
            lexicographicMode=False
        ):
            if errorIndication:
                self.logger.warning(f"SNMP bulk error: {errorIndication}")
                break
            elif errorStatus:
                self.logger.warning(f"SNMP bulk error: {errorStatus.prettyPrint()}")
                break
            else:
                for varBind in varBinds:
                    oid_str = str(varBind[0])
                    value_str = str(varBind[1])
                    data[oid_str] = value_str

        return data
