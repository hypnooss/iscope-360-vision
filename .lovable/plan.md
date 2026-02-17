

# Adicionar tuning de conntrack no instalador do Super Agent

## Problema
O nmap Phase 2 (full-range, 65535 portas) satura a tabela `nf_conntrack` do kernel, causando `Operation not permitted`. Isso precisa ser configurado automaticamente durante a instalacao.

## Mudanca

Adicionar uma funcao `tune_conntrack()` no script de instalacao (`supabase/functions/super-agent-install/index.ts`) que:

1. Cria `/etc/sysctl.d/99-iscope-conntrack.conf` com:
   - `nf_conntrack_max=262144` (4x o default de 65536)
   - `nf_conntrack_tcp_timeout_syn_sent=30` (reduz de 120s)
   - `nf_conntrack_tcp_timeout_time_wait=30` (reduz de 120s)
2. Aplica imediatamente com `sysctl -p`
3. Verifica se o modulo `nf_conntrack` esta carregado antes de aplicar (evita erro em sistemas sem conntrack)

## Onde inserir no fluxo

A funcao sera chamada em `main()` logo apos `install_scanner_tools` e antes de `ensure_user`, pois e uma configuracao de sistema relacionada aos scanners.

## Detalhes tecnicos

- Arquivo: `supabase/functions/super-agent-install/index.ts`
- Nova funcao bash `tune_conntrack()` (~20 linhas) inserida apos `install_scanner_tools()`
- Chamada adicionada na funcao `main()` na linha de sequencia entre `install_scanner_tools` e `ensure_user`
- A funcao e idempotente: sobrescreve o arquivo conf se ja existir
- Log informativo sobre o que foi configurado

