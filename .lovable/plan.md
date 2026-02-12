

# Fix: Propagar resultados entre steps do Attack Surface

## Problema

O pipeline de scan tem 3 steps sequenciais: masscan -> nmap -> httpx. Cada step depende dos resultados do anterior:

- **masscan** descobre portas abertas (ex: [22, 34210, 80, 443])
- **nmap** deveria receber essas portas para fazer fingerprint dos servicos
- **httpx** deveria receber as portas para probar servicos web

Porem, o orquestrador (`tasks.py`) so propaga `session_data` entre steps. O `result.data` (que contem `ports`, `services`, etc.) nunca e injetado no contexto. Resultado: nmap diz "No ports to scan" e httpx usa portas hardcoded (80, 443, 8080, 8443).

## Correcao

### Arquivo: `python-agent/agent/tasks.py`

Apos a execucao bem-sucedida de cada step (linha ~217), adicionar propagacao do `result.data` para o contexto:

```text
Antes (linha 217-218):
    if result.get('session_data'):
        context.update(result['session_data'])

Depois:
    if result.get('session_data'):
        context.update(result['session_data'])
    
    # Propagar dados do step para o contexto dos steps seguintes
    # Ex: masscan.data.ports -> context.ports -> nmap usa
    if result.get('data') and isinstance(result['data'], dict):
        context.update(result['data'])
```

Isso faz com que:
- Apos masscan: `context['ports'] = [22, 34210]`
- nmap recebe `context.get('ports')` = [22, 34210] e faz fingerprint
- Apos nmap: `context['services'] = [...]` (lista de servicos com CPEs)
- httpx recebe `context.get('ports')` com as portas reais

### Fluxo resultante

```text
masscan(ip) -> ports=[22, 80, 443, 34210]
     |
     v  context.ports = [22, 80, 443, 34210]
nmap(ip, ports) -> services=[{port:22, product:'OpenSSH'}, ...]
     |
     v  context.services = [...]
httpx(ip, ports) -> web_services=[{url:'https://...', tech:[...]}]
```

### Impacto no httpx

O executor httpx (linha 28-30 de `httpx_executor.py`) ja filtra as portas recebidas contra `DEFAULT_HTTP_PORTS`:

```python
ports = [p for p in all_ports if p in self.DEFAULT_HTTP_PORTS] or self.DEFAULT_HTTP_PORTS[:4]
```

Com a propagacao, ele recebera todas as portas do masscan, filtrara para HTTP (80, 443, 8080, etc.), e probara apenas as que existem de fato. Se nenhuma porta HTTP for encontrada pelo masscan, usara o fallback das 4 primeiras portas default.

## Resultado esperado

- nmap fara fingerprint de todas as portas descobertas pelo masscan
- httpx probara portas HTTP reais em vez de hardcoded
- Dados de servico (produto, versao, CPE) aparecerao na UI
- CVE matching ficara mais preciso com CPEs reais do nmap
