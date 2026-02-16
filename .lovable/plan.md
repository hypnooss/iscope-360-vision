

# Remover Fallback do httpx Quando Nmap Nao Encontra Portas

## Contexto

Atualmente, quando o nmap nao encontra portas abertas num IP, o httpx faz um fallback e tenta sondar 4 portas padrão (80, 443, 8080, 8443). Com o nmap agora confiavel (duas fases, scripts contextuais), esse fallback e desnecessario e consome tempo.

## Mudanca

**Arquivo: `python-agent/agent/executors/httpx_executor.py`**

Na linha 31-35, onde o codigo decide quais portas usar:

```python
# Codigo atual
ports = params.get('ports', [])
if not ports:
    all_ports = context.get('ports', [])
    ports = all_ports if all_ports else self.DEFAULT_HTTP_PORTS[:4]  # <-- fallback
```

Sera alterado para: se nao houver portas do contexto (nmap), retornar resultado vazio imediatamente sem executar o httpx:

```python
# Codigo novo
ports = params.get('ports', [])
if not ports:
    all_ports = context.get('ports', [])
    if not all_ports:
        self.logger.info(f"[httpx] No open ports from nmap on {target}, skipping probe")
        return {
            'data': {
                'ip': ip,
                'hostname': hostname or '',
                'web_services': [],
            }
        }
    ports = all_ports
```

## O que muda

- Se o nmap encontrou portas: httpx analisa todas elas (comportamento atual, sem mudanca)
- Se o nmap NAO encontrou portas: httpx retorna vazio imediatamente, economizando ~30-60s por IP

## Excecao: IPs de CDN

Para IPs de CDN (Cloudflare, etc), o nmap_discovery ja retorna uma lista fixa de 14 portas web. Portanto, o httpx sempre recebera portas no contexto para CDNs -- nao ha impacto nesse fluxo.

## Impacto

| Cenario | Antes | Depois |
|---|---|---|
| Nmap encontra portas | httpx analisa todas | Sem mudanca |
| Nmap NAO encontra portas | httpx tenta 4 portas default (~30-60s) | httpx retorna vazio (0s) |
| IP de CDN | httpx recebe 14 portas do contexto | Sem mudanca |

## Arquivo Modificado

| Arquivo | Mudanca |
|---|---|
| `python-agent/agent/executors/httpx_executor.py` | Remover fallback de portas default, retornar vazio quando nmap nao encontrou portas |

