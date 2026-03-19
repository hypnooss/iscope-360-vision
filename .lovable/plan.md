
Objetivo: corrigir o Terminal Remoto porque hoje ele “conecta”, mas a experiência ainda está incompleta. Pelo código atual, o problema não é só PTY.

1. Validar o handshake real entre UI e Supervisor
- O frontend mostra “Aguardando agente conectar...” e já permite digitar.
- A UI escuta um evento `ready`, mas o `RealtimeShell` atual não envia esse evento em nenhum momento.
- Plano: adicionar handshake explícito no Supervisor ao concluir o join do canal e usar esse evento para marcar a sessão como pronta na UI.

2. Ajustar o estado da UI para não liberar comando antes do agent estar pronto
- Hoje `inputReady = connected && channelReady`, ou seja, basta o browser entrar no canal.
- Isso mascara falhas do lado do agent.
- Plano: separar:
  - canal do browser conectado
  - agent pronto
  - comando em execução
- O input só deve ser habilitado após `ready` vindo do Supervisor.

3. Instrumentar logs do Realtime Shell para depuração operacional
- O log que você mostrou só prova que o heartbeat pediu para iniciar o shell.
- Ainda falta evidência de:
  - conexão WebSocket aberta
  - `phx_join` enviado
  - join confirmado
  - comando recebido
  - output transmitido
  - `done` transmitido
- Plano: reforçar logs nesses pontos para distinguir rapidamente:
  - problema de conexão
  - problema de broadcast
  - problema de execução do comando
  - problema só de renderização na UI

4. Corrigir o fluxo de saída no frontend
- A UI atual quebra `payload.data` por `\n` e renderiza como linhas estáticas.
- Isso funciona para comandos simples, mas é ruim para comandos interativos e para saídas com controle de terminal.
- Plano:
  - manter o PTY no Supervisor
  - melhorar o consumo do stream no frontend para não perder blocos vazios/atualizações
  - tratar melhor `\r` e sequências ANSI básicas, ou então migrar para um terminal real

5. Decidir a estratégia de renderização para comandos interativos
- `ip a` deveria aparecer mesmo no modelo atual se o broadcast estiver chegando.
- Já `top` e parte de `tail -f` pedem comportamento de terminal real.
- Plano recomendado: migrar o componente para um emulador de terminal real no frontend.
- Isso permite:
  - interpretar ANSI
  - lidar com carriage return
  - desenhar atualizações de tela corretamente
  - suportar melhor comandos interativos

6. Correção incremental sugerida
- Fase 1: corrigir handshake e bloquear input até `ready`
- Fase 2: adicionar logs de ponta a ponta
- Fase 3: validar `ip a`, `ls`, `cat`, `tail -f`
- Fase 4: substituir a área textual atual por terminal real para suportar `top` corretamente

Resultado esperado
- “Conectar” só vira sessão ativa quando o Supervisor realmente entrar no canal
- `ip a` e comandos curtos passam a mostrar retorno de forma confiável
- `tail -f` passa a streamar continuamente
- `top` deixa de depender de um renderer simplificado e passa a funcionar corretamente após adoção de um terminal real no frontend

Detalhes técnicos
- Backend: `python-agent/supervisor/realtime_shell.py`
  - emitir `ready` ao concluir o join
  - reforçar logs de ciclo de vida e de broadcast
- Frontend: `src/components/agents/RemoteTerminal.tsx`
  - criar estado `agentReady`
  - usar `ready` para habilitar input
  - revisar parser de stream
  - preferencialmente trocar renderização manual por terminal emulator
- Observação importante: pelo código atual, a ausência do evento `ready` já é um bug objetivo. Mesmo com PTY correto, a UI ainda está incompleta para terminal interativo.

Ordem de implementação
1. Corrigir evento `ready` no Supervisor
2. Ajustar gating da UI por `agentReady`
3. Adicionar logs diagnósticos
4. Melhorar renderização de stream
5. Evoluir para emulador de terminal real
