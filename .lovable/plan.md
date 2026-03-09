# Status: ✅ Implementado

## WHOIS via Agent — RDAP/HTTPS primário + TCP fallback

### Problema
- `rdap.registro.br` retorna 403 para IPs de cloud (Edge Functions)
- TCP porta 43 bloqueada em muitos ambientes corporativos

### Solução
Executor `domain_whois.py` usa **RDAP via HTTPS (porta 443)** como método primário, com fallback para TCP socket (porta 43). O Agent roda on-premise com IP corporativo, contornando ambos os bloqueios.

| Método | Porta | Quando usa |
|--------|-------|------------|
| RDAP/HTTPS | 443 | Primário — funciona em qualquer rede |
| WHOIS/TCP | 43 | Fallback — quando RDAP falha |

### Arquivos

| Arquivo | Mudança |
|---|---|
| `python-agent/agent/executors/domain_whois.py` | Executor com RDAP primário + TCP fallback |
| `python-agent/agent/executors/__init__.py` | Registrado `DomainWhoisExecutor` |
| `python-agent/agent/tasks.py` | Mapeamento `domain_whois` |
| Blueprint `external_domain` (DB) | Step `domain_whois` configurável |
| `supabase/functions/agent-task-result/index.ts` | Extrai WHOIS e atualiza `external_domains` |

### Próximos passos
- Deploy do Agent com novo executor
- Re-executar Domain Compliance nos domínios .br
