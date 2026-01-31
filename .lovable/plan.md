
## Diagnóstico (o que aconteceu e por quê)
- O instalador chegou até a etapa **“Baixando pacote do agent: iscope-agent-latest.tar.gz”** e falhou com:
  - `curl: (22) The requested URL returned error: 400`
- Conferi o Supabase Storage e:
  - o bucket `agent-releases` **existe e está público**
  - porém a lista de objetos em `storage.objects` para `agent-releases` está **vazia** (nenhum arquivo foi enviado ainda)
- Ou seja: **o instalador está correto**, mas **não há o arquivo** `iscope-agent-latest.tar.gz` no bucket; por isso o download falha.

## Objetivo do ajuste
1) Tornar a falha mais “autoexplicativa” (mensagem clara e guiando o operador ao próximo passo).
2) Exibir no painel (/agents) uma observação explícita: “antes de instalar, publique o pacote no bucket”.
3) (Opcional, mas recomendado) Melhorar o fluxo de download para ser mais seguro e facilitar troubleshooting.

---

## O que vamos implementar (mudanças no código)
### A) Melhorar o instalador (Edge Function `agent-install`)
**Arquivo:** `supabase/functions/agent-install/index.ts`

1. **Validar existência do pacote antes de tentar extrair**
   - Fazer um `curl -fsSI` (HEAD) na URL do tar.gz e checar o status.
   - Se não existir / falhar:
     - imprimir uma mensagem curta e direta, por exemplo:
       - “Não encontrei o pacote no Storage: agent-releases/iscope-agent-latest.tar.gz”
       - “Faça upload do tar.gz no bucket agent-releases e rode novamente”
       - “Link do Storage no Supabase: <URL>”
     - sair com código != 0 (fail fast).

2. **Melhorar a forma de download (evitar ‘tar’ em arquivo incompleto)**
   - Baixar para arquivo temporário e validar:
     - `curl -fsSL "$url" -o "$tmp"`
     - opcional: validar que não está vazio (`test -s "$tmp"`).
   - Só então rodar `tar -xzf`.

3. **Melhorar mensagem de erro do curl**
   - Usar `--fail-with-body` quando disponível, para facilitar debug em caso de erro HTTP.

4. **(Opcional) Mensagens de “próximos passos”**
   - Se baixar ok, seguir com o fluxo atual.
   - Se falhar, orientar: “verifique se o arquivo existe e se o bucket é público”.

### B) Tornar o painel mais claro (UI em /agents)
**Arquivo:** `src/components/agents/AgentInstallInstructions.tsx`

1. Adicionar um bloco pequeno (bem visível) antes do comando:
   - “Pré-requisito: publique o arquivo `iscope-agent-latest.tar.gz` no Supabase Storage (bucket `agent-releases`).”
2. Adicionar link clicável para o Storage do Supabase (bucket):
   - `https://supabase.com/dashboard/project/akbosdbyheezghieiefz/storage/buckets`
3. Manter os botões de cópia como estão.

### C) (Opcional) Verificação automática no painel
Se você quiser ir além (melhor UX), podemos:
- Criar uma Edge Function leve tipo `agent-release-status` que:
  - lista/checa se existe `iscope-agent-latest.tar.gz` no bucket usando **service role** (sem expor).
  - retorna `{ exists: true/false }`.
- A UI usa isso para mostrar:
  - “Release publicada: OK” ou “Release não publicada: faça upload”.

Isso evita que o usuário descubra o problema só depois de executar o comando no servidor.

---

## O que você (operacional) precisa fazer agora, antes de retestar
1) Gerar `iscope-agent-latest.tar.gz` com:
   - `python-agent/main.py`
   - `python-agent/agent/**`
   - `python-agent/requirements.txt`
2) Fazer upload para o bucket:
   - bucket: `agent-releases`
   - path/nome do arquivo: `iscope-agent-latest.tar.gz`
3) Retestar o comando:
   - `curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "...."`

---

## Plano de teste (end-to-end)
1) Confirmar que o arquivo existe via URL pública (do seu computador/servidor):
   - `curl -I https://akbosdbyheezghieiefz.supabase.co/storage/v1/object/public/agent-releases/iscope-agent-latest.tar.gz`
2) Rodar o instalador novamente no Oracle Linux.
3) Verificar:
   - `systemctl status iscope-agent --no-pager`
   - `journalctl -u iscope-agent -n 100 --no-pager`
4) Confirmar no painel que o Agent ficou “Online” (last_seen atualizando).

---

## Riscos / Observações
- O erro de SSSD (`DB version too old...`) apareceu no log do servidor, mas **não parece relacionado** ao instalador em si; o instalador falhou especificamente por falta do tar.gz no Storage.
- Depois que o tar.gz existir, o próximo ponto de atenção costuma ser:
  - Python/venv/requirements (compilação de deps) e permissões do systemd/service user.
  - Vamos monitorar pelo `journalctl` se acontecer.

