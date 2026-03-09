

# Fix: WHOIS via Agent usando HTTPS em vez de TCP porta 43

## Problema

A abordagem atual de WHOIS via TCP socket (porta 43) não funciona em muitos ambientes de clientes porque firewalls corporativos bloqueiam tráfego de saída na porta 43. Apenas portas comuns (80, 443) costumam estar liberadas.

## Solução

Modificar o executor `domain_whois.py` para usar **RDAP via HTTPS (porta 443)** como método primário, com fallback para TCP socket apenas se RDAP falhar. O Agent roda on-premise, então não sofre o bloqueio de IP do registro.br (diferente da Edge Function que roda em cloud). O RDAP do registro.br bloqueia IPs de **cloud/datacenter**, não IPs corporativos/residenciais.

### Estratégia de consulta (ordem):

1. **RDAP via HTTPS** (porta 443) -- funciona em qualquer rede
   - `.br`: `https://rdap.registro.br/domain/{domain}`
   - Genérico: `https://rdap.org/domain/{domain}`
   - Parsear JSON RDAP (events, entities)

2. **TCP socket porta 43** (fallback) -- caso RDAP falhe
   - Manter lógica atual como fallback para cenários onde RDAP não retorna dados

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `python-agent/agent/executors/domain_whois.py` | Adicionar RDAP/HTTPS como método primário, mover TCP socket para fallback |

### Detalhes técnicos

- Usar `urllib.request` (stdlib Python, sem dependências extras) para fazer GET HTTPS
- Parsear resposta JSON RDAP para extrair registrar, expires, created, owner
- Se RDAP falhar (timeout, 403, erro de parse), cair no TCP socket existente
- Manter compatibilidade Python 3.9 (`Optional` em vez de `X | None`)

