# Status: ✅ Implementado

## WHOIS via Agent (TCP Socket) — Fix para domínios .br

### Problema
- `rdap.registro.br` retorna 403 para IPs de cloud (Edge Functions)
- Apenas domínios GoDaddy funcionavam via RDAP

### Solução
Coleta WHOIS via TCP socket (porta 43) executada pelo Agent on-premise.

| Arquivo | Mudança |
|---|---|
| `python-agent/agent/executors/domain_whois.py` | **Novo** — executor WHOIS via socket TCP com suporte a .br, .com, .net, .org, etc. |
| `python-agent/agent/executors/__init__.py` | Registrado `DomainWhoisExecutor` |
| `python-agent/agent/tasks.py` | Adicionado `domain_whois` no mapeamento de executors |
| Blueprint `external_domain` (DB) | Adicionado step `domain_whois` com servidores configuráveis |
| `supabase/functions/agent-task-result/index.ts` | Extrai dados WHOIS do step result e atualiza `external_domains` |

### Como funciona
1. Agent recebe task `external_domain_analysis` com step `domain_whois`
2. Executor consulta `whois.registro.br` (para .br) via TCP socket porta 43
3. Extrai registrar, expires, created, owner via regex
4. Resultado é enviado como step result progressivo
5. `agent-task-result` recebe e faz UPDATE em `external_domains` (whois_registrar, whois_expires_at, etc.)

### Próximos passos
- Deploy do Agent com novo executor
- Re-executar Domain Compliance nos domínios .br

---

## Otimizações anteriores

(ver histórico no git)
