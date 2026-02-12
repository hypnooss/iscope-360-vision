

# Fix: httpx deve probar todas as portas descobertas pelo masscan

## Contexto

O pipeline agora funciona corretamente: masscan descobre portas, nmap faz fingerprint, e httpx complementa com dados web. Porem o httpx ainda filtra as portas contra uma lista de portas HTTP conhecidas (80, 443, 8080, etc.), ignorando portas fora do padrao como 34210, 853, 541, etc. -- que podem ter servidores web.

## Correcao

### Arquivo: `python-agent/agent/executors/httpx_executor.py`

Alterar a linha 31 para usar **todas** as portas descobertas pelo masscan, sem filtro:

```text
Antes (linha 29-31):
    all_ports = context.get('ports', [])
    # Filter to likely HTTP ports
    ports = [p for p in all_ports if p in self.DEFAULT_HTTP_PORTS] or self.DEFAULT_HTTP_PORTS[:4]

Depois:
    all_ports = context.get('ports', [])
    # Probe all discovered ports - web servers can run on any port
    ports = all_ports if all_ports else self.DEFAULT_HTTP_PORTS[:4]
```

O httpx e rapido e lida bem com portas nao-HTTP (simplesmente retorna vazio para elas). O fallback para `DEFAULT_HTTP_PORTS[:4]` so e usado quando nenhuma porta foi descoberta (masscan falhou ou nao encontrou nada).

## Resultado esperado

No proximo scan do IP `200.187.72.219`, o httpx probara as portas `22,80,443,34210` em vez de apenas `80,443`. Se houver um servidor web na porta 34210, ele sera detectado.

