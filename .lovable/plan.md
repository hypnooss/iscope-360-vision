

## Análise: SSH encapsulado em HTTPS via Edge Function

### Por que SSH direto não funciona neste cenário

O conceito de "SSH tunelado por HTTPS" pressupõe que a Edge Function consegue **abrir uma conexão TCP direta ao agente**. Isso não é possível por três razões:

```text
                    ┌──────────────┐
  Browser ──HTTPS──▶│ Edge Function │──SSH──▶ Agent ???
                    └──────────────┘
                                         ▲
                                         │
                                    BLOQUEADO:
                                    • Agent atrás de NAT/firewall
                                    • Sem porta SSH exposta à internet
                                    • Edge Function não suporta TCP raw
```

1. **O agente está atrás de NAT/firewall** — não aceita conexões de entrada. Toda a arquitetura foi desenhada com o agente fazendo conexões de SAÍDA (polling, heartbeat). Expor SSH do agente à internet seria um risco de segurança enorme.

2. **Edge Functions não suportam conexões TCP raw** — rodam em Deno Deploy, que só permite HTTP/HTTPS outbound. Não é possível abrir um socket SSH.

3. **Edge Functions têm timeout de ~60 segundos** — uma sessão SSH interativa precisa ficar aberta indefinidamente.

### O que realmente causa a lentidão atual

O problema NÃO é a via de comunicação, é o **intervalo de polling**:

```text
Fluxo atual (lento):
  Comando inserido no DB
    → Agent espera heartbeat (60s) para saber que tem comando
    → Executa em ~1s
    → Resultado volta ao DB
    → Frontend recebe via postgres_changes (instantâneo)

Gargalo: os 60 segundos de espera do heartbeat
```

Os logs comprovam: quando o agente **encontra** o comando, executa em ~1 segundo:
```
16:20:36,829 [RemoteCmd] 1 comando(s) pendente(s)
16:20:36,830 [RemoteCmd] Executando: systemctl status iscope-supervisor...
16:20:37,592 [RemoteCmd] Comando 27664088... finalizado (exit=0)
```

### Solução já aprovada: polling rápido (2s)

O plano aprovado anteriormente (substituir WebSocket por polling HTTP de 2s) resolve o problema de forma simples e confiável:

```text
Fluxo com polling rápido:
  Comando inserido no DB
    → Agent descobre em ≤2s (poll rápido)
    → Executa em ~1s
    → Resultado volta ao DB
    → Frontend recebe via postgres_changes (instantâneo)
    
Total: ~3 segundos (máximo)
```

- Usa a mesma infraestrutura REST que **já funciona perfeitamente**
- Sem WebSocket, sem Phoenix protocol, sem problemas de join
- O agente simplesmente chama `GET /agent-commands` a cada 2 segundos enquanto o shell está ativo

### Resumo

| Abordagem | Latência | Viável? | Complexidade |
|-----------|----------|---------|--------------|
| SSH direto via Edge Function | ~0s | Não (NAT/firewall) | — |
| WebSocket Realtime (atual) | ~1s | Não (join falha) | Alta |
| **Polling rápido (2s)** | **≤3s** | **Sim** | **Baixa** |
| HTTP Long-polling | ~1s | Possível | Média-alta |

A abordagem de polling rápido (2s) é a mais pragmática. Se 3 segundos ainda for inaceitável no futuro, podemos evoluir para HTTP long-polling, mas isso adiciona complexidade significativa nas Edge Functions.

### Próximo passo

Implementar o plano já aprovado: substituir o `RealtimeCommandListener` (WebSocket) por um `ShellCommandPoller` (HTTP polling 2s), adicionar loading state no frontend, e remover o broadcast.

