

# Otimizacao: Pular nmap_discovery em IPs de CDN

## Problema atual

Quando o `asn_classifier` detecta um IP de CDN (Cloudflare, Akamai, etc.), o `nmap_discovery` ainda roda um scan `--top-ports 1000` que leva ~7 minutos e encontra 0 portas uteis (o CDN responde em tudo ou em nada, dependendo da configuracao). Tempo desperdicado.

## Solucao

Modificar o `nmap_discovery.py` para que, quando `is_cdn=True`, ele **retorne imediatamente** a lista fixa de 18 portas web sem executar nenhum scan. O fingerprint (`nmap.py`) e o `httpx` ja recebem as portas via contexto e funcionam normalmente.

### Lista de portas CDN (18 portas)

| Porta | Servico |
|---|---|
| 80 | HTTP padrao |
| 443 | HTTPS padrao |
| 8080 | HTTP alternativo / proxies |
| 8443 | HTTPS alternativo / paineis |
| 8000 | HTTP dev / APIs |
| 8888 | HTTP alternativo / Jupyter |
| 2052 | Cloudflare HTTP |
| 2053 | Cloudflare HTTPS |
| 2082 | Cloudflare HTTP |
| 2083 | Cloudflare HTTPS |
| 2086 | Cloudflare HTTP |
| 2087 | Cloudflare HTTPS |
| 2095 | Cloudflare HTTP |
| 2096 | Cloudflare HTTPS |

### Impacto no tempo

| Cenario | Antes | Depois |
|---|---|---|
| CDN (discovery) | ~7 minutos | ~0 segundos |
| CDN (fingerprint 18 portas) | ~0s (recebia 0 portas) | ~30-90s |
| CDN (total pipeline) | ~7 min + ~0s = ~7 min | ~0s + ~90s = ~90s |
| Non-CDN | Sem mudanca | Sem mudanca |

## Detalhes tecnicos

### Arquivo: `python-agent/agent/executors/nmap_discovery.py`

Na secao `if is_cdn:` (linhas 33-41), em vez de configurar parametros de scan e chamar `_run_scan`, retornar diretamente a lista de portas:

```python
CDN_WEB_PORTS = [
    80, 443, 8080, 8443, 8000, 8888,
    2052, 2053, 2082, 2083, 2086, 2087, 2095, 2096,
]

# Dentro do metodo run(), no bloco if is_cdn:
if is_cdn:
    self.logger.info(
        f"[nmap_discovery] CDN detected ({cdn_provider}), "
        f"skipping discovery - using {len(CDN_WEB_PORTS)} standard web ports"
    )
    return {
        'data': {
            'ip': ip,
            'ports': CDN_WEB_PORTS,
        }
    }
```

O resto do metodo (scan non-CDN, false-positive protection, etc.) permanece identico.

### Nenhuma mudanca necessaria nos outros arquivos

- `nmap.py` (fingerprint): ja recebe portas do contexto e faz `-sV` nelas
- `httpx_executor.py`: ja recebe portas do contexto
- `tasks.py`: propagacao de contexto ja funciona (`context.update(result['data'])`)
- Blueprint: nenhuma alteracao (os steps continuam os mesmos, so o discovery retorna mais rapido)

