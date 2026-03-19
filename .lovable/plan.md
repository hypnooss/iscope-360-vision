
Sim: pelo estado dos registros, essas tarefas nunca iniciaram.

O que validei:
- As `agent_tasks` do tipo `fortigate_analyzer` ainda estão com:
  - `status = 'pending'`
  - `started_at = null`
  - `completed_at = null`
  - `expires_at` já vencido há muitas horas
- Exemplo real no banco:
  - criadas por volta de `2026-03-18 22:15`
  - `expires_at` por volta de `2026-03-18 23:15`
  - continuam `pending`
- O agent ligado a elas está online agora, mas ficou offline no período do incidente.

Diagnóstico:
1. O campo `expires_at` não encerra a task sozinho
   - Ele é só um timestamp de validade.
   - A task só muda para `timeout` quando algum processo faz `UPDATE` nela.

2. Essas tasks nunca foram “picked up”
   - Como `started_at` está `null`, o agent não chegou a buscar/executar.
   - Então o problema não é “travou executando”; é “ficou pendente e ninguém limpou”.

3. O cleanup atual é oportunista e limitado
   - No `trigger-firewall-analyzer`, existe cleanup de tasks expiradas e snapshots órfãos.
   - Porém esse cleanup roda apenas quando essa função é chamada para aquele `firewall_id`.

4. Há um detalhe importante na ordem do código
   - Hoje a função checa se o agent está offline antes de rodar o cleanup.
   - Se o agent estiver offline, ela retorna `AGENT_OFFLINE` e sai.
   - Resultado: durante as 18h offline, novas tentativas não limpavam as tasks antigas.

Conclusão objetiva:
- Sim, sua leitura está correta: elas ficaram como “pendentes” porque nunca começaram.
- E também está correta a expectativa de negócio de que “deveriam encerrar por timeout” — mas tecnicamente isso ainda não é automático no banco; depende de uma rotina de limpeza.

Plano de correção recomendado:
1. Mover o cleanup para antes da verificação de agent offline
   - Assim, qualquer tentativa de trigger já limpa tasks expiradas, mesmo com agent offline.

2. Criar um cleanup global periódico
   - Ex.: uma rotina agendada para marcar como `timeout` todas as `agent_tasks` expiradas e snapshots órfãos, sem depender de novo trigger por firewall.

3. Ajustar a tela de histórico/listagem
   - Se a UI estiver lendo só `status = 'pending'`, ela continuará mostrando lixo histórico.
   - A tela deve refletir timeout real ou considerar `expires_at < now` como expirado, caso ainda exista resíduo antigo.

4. Corrigir o passivo atual no banco
   - Executar um update manual para marcar como `timeout` todas as tasks expiradas desse agent/firewall analyzer.
   - Fazer o mesmo para snapshots `pending/processing` antigos.

Detalhe técnico:
```text
Hoje o fluxo é:
trigger-firewall-analyzer
  -> busca firewall
  -> verifica acesso
  -> verifica agent online
     -> se offline, retorna
  -> só depois tenta limpar expired tasks/snapshots

O ideal é:
trigger-firewall-analyzer
  -> busca firewall
  -> verifica acesso
  -> limpa expired tasks/snapshots
  -> verifica agent online
     -> se offline, retorna
```

Se formos implementar, eu focaria em:
- `supabase/functions/trigger-firewall-analyzer/index.ts`
- possível job/scheduler global para `agent_tasks`
- tela que lista essas execuções pendentes para não exibir expiradas como ativas
