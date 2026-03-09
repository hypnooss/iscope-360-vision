# Status: ✅ Implementado

## Fix: WHOIS data not being saved + parsing issues

### Mudanças realizadas

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-task-result/index.ts` | Force redeploy (comment timestamp) para ativar extração domain_whois |
| `supabase/functions/trigger-external-domain-analysis/index.ts` | Removida chamada duplicada ao `domain-whois-lookup` edge function |
| `python-agent/agent/executors/domain_whois.py` | `.br`: registrar fixo "Registro.br (NIC.br)", busca events em entities aninhadas |
| `python-agent/agent/executors/domain_whois.py` | `.io`: RDAP endpoint corrigido para `rdap.identitydigital.services` |
| `python-agent/agent/executors/domain_whois.py` | Owner: extrai registrant separado do registrar (evita confundir dono com registrar) |

### Próximos passos
- Deploy do Agent com `domain_whois.py` atualizado
- Re-executar análise nos domínios .br e precisio.io para validar
