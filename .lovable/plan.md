

## Validação DNS de Subdomínios Descobertos

### Problema Identificado

As APIs de enumeração de subdomínios retornam registros históricos que podem não existir mais. Na imagem, vemos subdomínios como `chat.taschibra.com.br`, `drive.taschibra.com.br`, etc. sem endereços IP resolvidos - indicando que podem ser registros antigos.

### Solução Proposta

Adicionar uma etapa de **validação DNS** após a coleta, que tenta resolver cada subdomínio para verificar se ainda existe.

### Alterações no Arquivo

**Arquivo:** `python-agent/agent/executors/subdomain_enum.py`

### 1. Novo Método de Resolução DNS

```python
def _resolve_subdomain(self, subdomain: str, timeout: float = 2.0) -> Dict[str, Any]:
    """
    Resolve a subdomain to get its IP addresses.
    Returns dict with 'ips' list and 'is_alive' boolean.
    """
    try:
        import dns.resolver
    except ImportError:
        # Fallback to socket if dnspython not available
        try:
            ips = list(set(socket.gethostbyname_ex(subdomain)[2]))
            return {'ips': sorted(ips), 'is_alive': len(ips) > 0}
        except socket.gaierror:
            return {'ips': [], 'is_alive': False}
        except Exception:
            return {'ips': [], 'is_alive': False}

    resolver = dns.resolver.Resolver(configure=True)
    resolver.lifetime = timeout
    resolver.timeout = timeout

    ips = set()
    
    # Try A records (IPv4)
    try:
        answers = resolver.resolve(subdomain, 'A')
        for r in answers:
            ips.add(str(r))
    except Exception:
        pass

    # Try AAAA records (IPv6)
    try:
        answers = resolver.resolve(subdomain, 'AAAA')
        for r in answers:
            ips.add(str(r))
    except Exception:
        pass

    return {
        'ips': sorted(list(ips)),
        'is_alive': len(ips) > 0
    }
```

### 2. Método de Validação em Lote

```python
def _validate_subdomains(self, subdomains: Dict[str, Dict], step_id: str) -> Dict[str, Dict]:
    """
    Validate all discovered subdomains by resolving their DNS.
    Adds 'ips' and 'is_alive' to each subdomain entry.
    """
    total = len(subdomains)
    alive_count = 0
    
    self.logger.info(f"Step {step_id}: Validating {total} subdomains via DNS resolution...")
    
    for idx, (name, data) in enumerate(subdomains.items(), 1):
        result = self._resolve_subdomain(name)
        data['ips'] = result['ips']
        data['is_alive'] = result['is_alive']
        
        if result['is_alive']:
            alive_count += 1
        
        # Log progress every 10 subdomains
        if idx % 10 == 0 or idx == total:
            self.logger.info(f"Step {step_id}: Validated {idx}/{total} subdomains ({alive_count} alive)")
    
    self.logger.info(f"Step {step_id}: Validation complete - {alive_count}/{total} subdomains are alive")
    
    return subdomains
```

### 3. Atualização do Método run()

Adicionar chamada de validação antes de retornar os resultados:

```python
# Após coletar de todas as fontes, antes de ordenar

# Validate subdomains via DNS resolution
all_subdomains = self._validate_subdomains(all_subdomains, step_id)

# Separate alive and dead subdomains for stats
alive_subdomains = {k: v for k, v in all_subdomains.items() if v.get('is_alive')}
dead_subdomains = {k: v for k, v in all_subdomains.items() if not v.get('is_alive')}

# Sort results
subdomains_list = sorted(all_subdomains.values(), key=lambda x: x['subdomain'])

self.logger.info(
    f"Step {step_id}: Total {len(subdomains_list)} unique subdomains from {len(sources_used)} sources "
    f"({len(alive_subdomains)} alive, {len(dead_subdomains)} inactive)"
)

return {
    'status_code': 200,
    'data': {
        'domain': domain,
        'total_found': len(subdomains_list),
        'alive_count': len(alive_subdomains),
        'inactive_count': len(dead_subdomains),
        'sources': sources_used,
        'subdomains': subdomains_list,
        'errors': errors if errors else None,
    },
    'error': None,
}
```

### 4. Estrutura de Dados Atualizada

Cada subdomínio agora terá:

```json
{
  "subdomain": "chat.taschibra.com.br",
  "sources": ["crt.sh", "rapiddns"],
  "ips": ["192.168.1.10", "2001:db8::1"],
  "is_alive": true
}
```

Ou para subdomínios inativos:

```json
{
  "subdomain": "old.taschibra.com.br",
  "sources": ["wayback"],
  "ips": [],
  "is_alive": false
}
```

### Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Dados** | Lista bruta de subdomínios | Lista validada com IPs |
| **Qualidade** | Muitos registros obsoletos | Separação claro entre ativos/inativos |
| **Visibilidade** | Sem indicação de status | Campo `is_alive` e lista de `ips` |
| **Relatório** | Coluna "Endereços IP" vazia | IPs preenchidos para subdomínios ativos |

### Considerações de Performance

- **Timeout curto (2s)**: Evita atrasos excessivos em subdomínios inexistentes
- **Resolução sequencial**: Mais lento, mas evita rate limiting de servidores DNS
- **Opção futura**: Implementar resolução paralela com ThreadPoolExecutor para maior velocidade

### Deploy

1. Atualizar `subdomain_enum.py` no servidor
2. Limpar cache: `rm -rf /opt/iscope-agent/agent/__pycache__ /opt/iscope-agent/agent/executors/__pycache__`
3. Reiniciar: `systemctl restart iscope-agent`
4. Disparar nova análise de External Domain

