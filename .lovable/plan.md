
Objetivo: eliminar o loop de update falso (Agent já em v1.3.4, mas heartbeat ainda reporta v1.3.3), que está causando download/reinstalação repetida.

Diagnóstico (com base no log + código):
1) O Worker sobe corretamente em v1.3.4:
   - `Worker v1.3.4 iniciando...`
2) No ciclo seguinte, o heartbeat enviado pelo Supervisor continua como v1.3.3:
   - `Enviando heartbeat (v1.3.3)`
3) Em `python-agent/supervisor/heartbeat.py`, o Supervisor chama:
   - `self.heartbeat.send(... supervisor_version=...)`
   - sem passar `version=...`
4) Em `python-agent/agent/heartbeat.py`, quando `version` não é informado, ele usa `agent.version.get_version()` já carregado em memória no processo do Supervisor.
5) Como o Supervisor não reinicia ao atualizar só o Worker, ele mantém módulo antigo em memória e continua reportando versão defasada.

Conclusão: bug de “versão em memória stale” no processo Supervisor, não falha de instalação do pacote.

Arquitetura atual (resumo):
```text
Supervisor process (long-lived)
  ├─ imports agent.heartbeat -> imports agent.version (cached in memory)
  ├─ updates Worker files on disk to 1.3.4
  ├─ restarts Worker only
  └─ keeps sending heartbeat with old cached version (1.3.3)
       -> backend says update_available=true
       -> loop
```

Plano de implementação:
1) Tornar a versão do Agent no heartbeat “runtime from disk”, não “import cache”
   - Arquivo: `python-agent/supervisor/heartbeat.py`
   - Ajustar `tick()` para aceitar `agent_version` explícita.
   - Passar `version=agent_version` para `self.heartbeat.send(...)`.
   - Melhorar log para incluir `agent_version` e `supervisor_version` no mesmo evento.

2) Criar resolução robusta da versão do Worker no Supervisor
   - Arquivo: `python-agent/supervisor/main.py`
   - Adicionar helper para ler `/opt/iscope-agent/agent/version.py` (via `WORKER_INSTALL_DIR`) e extrair `__version__` por regex.
   - Fallback seguro:
     a) última versão conhecida válida em memória do Supervisor, ou
     b) `agent.version.get_version()` apenas como fallback final.
   - Em cada loop heartbeat, calcular versão atual do Worker e passar ao `hb_loop.tick(agent_version=...)`.

3) Hardening para evitar update redundante mesmo em caso de ruído
   - Arquivo: `python-agent/supervisor/main.py` (em `_handle_update`)
   - Antes de iniciar update:
     - comparar `update_info.version` com versão do Worker lida em disco.
     - se iguais, logar “skip update (already current on disk)” e não baixar pacote.
   - Isso previne tempestade de update caso haja latência/estado transitório no backend.

4) Observabilidade para troubleshooting
   - Padronizar logs:
     - heartbeat enviado: `agent=X supervisor=Y`
     - decisão de update: `latest=X current=Y action=skip|apply`
   - Facilita confirmar correção sem acesso ao código no host.

Seção técnica (detalhes para implementação):
- Arquivos impactados:
  - `python-agent/supervisor/heartbeat.py`
  - `python-agent/supervisor/main.py`
- Sem mudança de schema DB.
- Sem mudança de Edge Function obrigatória para corrigir esta causa raiz.
- Compatível com a estratégia de Cross-Update atual (Supervisor atualiza Worker; Worker atualiza Supervisor).
- Não exige restart do Supervisor a cada update de Worker (mantém arquitetura correta e estável).

Plano de validação (E2E em host real):
1) Aplicar patch e gerar novo pacote do Agent (incluindo `supervisor/main.py` e `supervisor/heartbeat.py` atualizados, pois supervisor roda do mesmo install dir).
2) Atualizar um host teste.
3) Verificar logs após update:
   - esperado: `Worker v1.3.4 iniciando...`
   - esperado no heartbeat seguinte: `Enviando heartbeat (v1.3.4)` (não 1.3.3)
   - esperado: `update=False` após convergência
   - esperado: não repetir download de `iscope-agent-1.3.4.tar.gz`.
4) Testar cenário forçado:
   - subir `agent_latest_version` para versão maior.
   - esperado: 1 único ciclo de update bem-sucedido.
5) Testar regressão:
   - Supervisor update continua funcional (sinal `supervisor_update_available` e fluxo pending file/flag).

Riscos e mitigação:
- Risco: falha ao parsear `agent/version.py`.
  - Mitigação: fallback controlado + log explícito da fonte da versão usada.
- Risco: caminho de instalação customizado.
  - Mitigação: usar `WORKER_INSTALL_DIR` já existente em `supervisor/config.py`.

Critério de pronto:
- Após update para versão atual, heartbeat reporta versão correta do Worker.
- Backend para de sinalizar `update_available` indevido.
- Não há loop de atualização repetitiva.
