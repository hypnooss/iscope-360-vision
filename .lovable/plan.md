

# Fix: masscan nao encontra portas por falta de permissoes

## Problema

O masscan usa raw sockets para enviar pacotes SYN diretamente (e por isso e tao rapido). Quando executado sem root ou sem `CAP_NET_RAW`, ele simplesmente nao consegue enviar pacotes e retorna stdout vazio, sem erro explícito. O executor interpreta isso como "0 portas encontradas" em vez de reportar o erro.

O httpx funciona porque usa conexoes TCP normais (nao precisa de raw sockets).

## Correcao - Parte 1: Servidor (manual)

Executar no servidor do Super Agent:

```text
sudo setcap cap_net_raw+ep /usr/local/bin/masscan
```

Isso permite ao masscan usar raw sockets sem precisar de root. Alternativa: adicionar ao script de instalacao do super-agent.

## Correcao - Parte 2: Executor (codigo)

### Arquivo: `python-agent/agent/executors/masscan.py`

Adicionar verificacao do `returncode` e `stderr` apos executar o masscan. Quando o stdout esta vazio mas o processo retornou erro, reportar como erro em vez de "0 portas".

Alteracoes:
- Apos `subprocess.run()`, verificar `result.returncode != 0`
- Se `returncode != 0` e stdout vazio, retornar `error` com conteudo do stderr
- Adicionar log do stderr para facilitar debug futuro
- Manter o comportamento atual (retornar ports=[]) apenas quando `returncode == 0` e stdout vazio (scan legítimo sem portas abertas)

```text
Antes (linha 46-49):
  raw_output = result.stdout.strip()
  if not raw_output:
      self.logger.info(f"[masscan] No open ports found on {ip}")
      return {'data': {'ip': ip, 'ports': []}}

Depois:
  raw_output = result.stdout.strip()
  stderr_output = result.stderr.strip() if result.stderr else ''

  if stderr_output:
      self.logger.warning(f"[masscan] stderr: {stderr_output[:500]}")

  if not raw_output:
      if result.returncode != 0:
          error_msg = stderr_output or f'masscan exited with code {result.returncode}'
          self.logger.error(f"[masscan] Failed on {ip}: {error_msg}")
          return {'error': f'masscan failed: {error_msg}'}
      self.logger.info(f"[masscan] No open ports found on {ip}")
      return {'data': {'ip': ip, 'ports': []}}
```

## Correcao - Parte 3: Instalador do Super Agent

### Arquivo: `supabase/functions/super-agent-install/index.ts`

Adicionar o `setcap` ao script de instalacao para que novos Super Agents ja tenham a permissao correta:

```text
# Apos instalar masscan:
setcap cap_net_raw+ep /usr/local/bin/masscan
```

## Resultado esperado

- masscan passa a encontrar portas abertas (80, 443, etc)
- nmap recebe a lista de portas e faz fingerprint detalhado
- O executor reporta erro claro quando masscan falha por permissao
- Novos Super Agents ja terao a permissao configurada automaticamente

