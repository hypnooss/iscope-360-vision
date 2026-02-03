

## Diagnóstico: Amass Executor Retornando 0 Resultados

### Problema Identificado

Após análise detalhada, confirmei que:

1. **Mapeamento correto**: O step usa `type: 'amass'` (não `subdomain_enum`), então o mapeamento já funcionava antes da alteração
2. **Domínio passado corretamente**: O log mostra `Running Amass (passive) for taschibra.com.br`
3. **Execução em ~23ms**: Impossível para uma execução real do Amass (deveria levar segundos/minutos)
4. **Teste manual funciona**: `subprocess.run` com Python interativo retorna resultados

### Causa Raiz Provável

O problema está no **ambiente de execução do systemd** vs execução interativa:
- **Usuário diferente**: O Agent roda como `iscope` (não `root`)
- **PATH diferente**: O binário `/usr/local/bin/amass` pode não estar no PATH do serviço
- **HOME/Config diferentes**: Amass pode precisar de diretórios de configuração

### Evidência Técnica

O `shutil.which('amass')` pode retornar `None` no contexto do serviço systemd, fazendo o executor retornar imediatamente com erro silencioso. Mas o log mostra "Running Amass" que só aparece **após** a verificação do path (linha 59), então o path está sendo encontrado.

Outra possibilidade: **Amass está retornando rapidamente sem resultados** por falta de configuração ou permissões de rede no contexto do usuário `iscope`.

### Solução: Adicionar Logging Detalhado

Adicionar logs para capturar:
1. O comando exato executado
2. Return code do processo
3. Tempo de execução real do subprocess
4. stdout e stderr completos
5. Variáveis de ambiente relevantes

### Alterações

**Arquivo:** `python-agent/agent/executors/amass.py`

Modificar o método `run()` para incluir logging detalhado:

```python
def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    config = step.get('config', {}) or {}
    step_id = step.get('id', 'unknown')

    domain = (config.get('domain') or context.get('domain') or '').strip().rstrip('.')
    mode = config.get('mode', 'passive').lower()
    timeout = min(config.get('timeout', self.DEFAULT_TIMEOUT), self.MAX_TIMEOUT)
    max_depth = config.get('max_depth', 1)

    if not domain:
        return {'status_code': 0, 'data': None, 'error': 'Missing domain'}

    amass_path = shutil.which('amass')
    if not amass_path:
        self.logger.error(f"Step {step_id}: Amass not installed")
        return {
            'status_code': 0,
            'data': {'domain': domain, 'subdomains': []},
            'error': 'Amass not installed. Run agent installer with --update.'
        }

    self.logger.info(f"Step {step_id}: Running Amass ({mode}) for {domain}")

    try:
        # Build command
        cmd = [
            amass_path,
            'enum',
            '-d', domain,
            '-timeout', str(int(timeout / 60)),
        ]

        if mode == 'passive':
            cmd.append('-passive')
        elif mode == 'active':
            cmd.extend(['-active', '-brute'])
            if max_depth > 1:
                cmd.extend(['-max-depth', str(max_depth)])

        # ===== NOVO: Log detalhado antes da execução =====
        self.logger.info(f"Step {step_id}: Command: {' '.join(cmd)}")
        self.logger.info(f"Step {step_id}: Timeout: {timeout}s, CWD: /tmp")
        
        import time as _time
        exec_start = _time.time()
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 30,
            cwd='/tmp'
        )
        
        exec_ms = int((_time.time() - exec_start) * 1000)
        
        # ===== NOVO: Log detalhado após execução =====
        self.logger.info(
            f"Step {step_id}: Amass finished in {exec_ms}ms | "
            f"RC={result.returncode} | "
            f"stdout={len(result.stdout or '')} chars | "
            f"stderr={len(result.stderr or '')} chars"
        )
        
        # Log primeiras linhas de stdout/stderr para debug
        if result.stdout:
            first_lines = '\n'.join(result.stdout.strip().split('\n')[:5])
            self.logger.info(f"Step {step_id}: STDOUT preview:\n{first_lines}")
        if result.stderr:
            self.logger.info(f"Step {step_id}: STDERR: {result.stderr.strip()[:200]}")
        
        # Parse text output
        combined_output = (result.stdout or '') + '\n' + (result.stderr or '')
        subdomains, sources_set = self._parse_amass_output(combined_output, domain)

        subdomains.sort(key=lambda x: x['subdomain'])

        self.logger.info(
            f"Step {step_id}: Amass found {len(subdomains)} unique subdomains "
            f"from {len(sources_set)} sources"
        )

        return {
            'status_code': 200,
            'data': {
                'domain': domain,
                'mode': mode,
                'total_found': len(subdomains),
                'sources': sorted(list(sources_set)),
                'subdomains': subdomains,
            },
            'error': None,
        }

    except subprocess.TimeoutExpired:
        self.logger.error(f"Step {step_id}: Amass timeout after {timeout}s")
        return {
            'status_code': 0,
            'data': {'domain': domain, 'subdomains': []},
            'error': f'Amass timeout after {timeout} seconds'
        }

    except Exception as e:
        self.logger.error(f"Step {step_id}: Amass error - {str(e)}")
        return {
            'status_code': 0,
            'data': {'domain': domain, 'subdomains': []},
            'error': str(e),
        }
```

### Passos de Deploy

Após aprovação:
1. Atualizar o arquivo `amass.py` no repositório
2. Copiar para o servidor: `/opt/iscope-agent/agent/executors/amass.py`
3. Limpar cache: `rm -rf /opt/iscope-agent/agent/__pycache__ /opt/iscope-agent/agent/executors/__pycache__`
4. Reiniciar: `systemctl restart iscope-agent`
5. Disparar análise e verificar logs com detalhes

### Resultado Esperado

Os logs irão mostrar:
```
Step subdomain_enum: Command: /usr/local/bin/amass enum -d taschibra.com.br -timeout 5 -passive
Step subdomain_enum: Timeout: 300s, CWD: /tmp
Step subdomain_enum: Amass finished in 23ms | RC=0 | stdout=0 chars | stderr=0 chars
```

Se stdout/stderr estiverem vazios mas RC=0, isso indica que o Amass está retornando sem executar (provavelmente configuração/permissões). Se tiver output, o parser pode estar com problema.

