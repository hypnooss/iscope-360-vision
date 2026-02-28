

## Modo Offline para o Script de Instalação do Agent

### Problema
O servidor `srv-zbx-proxy` não consegue fazer conexões HTTPS ao Supabase (TLS reset), impedindo tanto o download do script quanto dos pacotes `.tar.gz`.

### Solução
Adicionar flags `--local-agent` e `--local-supervisor` ao script gerado por `agent-install/index.ts`. Quando fornecidos, o instalador pula `get_signed_url` e usa os arquivos `.tar.gz` locais diretamente.

### Mudanças

**Arquivo: `supabase/functions/agent-install/index.ts`**

1. Adicionar variáveis `LOCAL_AGENT=""` e `LOCAL_SUPERVISOR=""` junto das outras variáveis globais (linha ~41)

2. Adicionar parsing dos novos flags em `parse_args()`:
   - `--local-agent` → caminho para o `.tar.gz` do agent
   - `--local-supervisor` → caminho para o `.tar.gz` do supervisor

3. Modificar `download_release()` para verificar se os caminhos locais foram fornecidos:
   - Se `LOCAL_AGENT` e `LOCAL_SUPERVISOR` estiverem preenchidos, pular download e usar os arquivos locais
   - Se apenas um for fornecido, exigir o outro também
   - Manter o fluxo normal (signed URL + curl) como fallback quando não fornecidos

4. Atualizar `usage()` para documentar os novos flags

### Fluxo de Uso (Offline)

```text
# Na máquina com acesso à internet:
1. Baixar o script:
   curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install -o install.sh

2. Baixar os pacotes (via browser ou curl):
   - iscope-agent-latest.tar.gz
   - iscope-supervisor-latest.tar.gz
   (do bucket agent-releases no dashboard Supabase)

3. Transferir tudo para o servidor:
   scp install.sh iscope-agent-latest.tar.gz iscope-supervisor-latest.tar.gz root@srv-zbx-proxy:/tmp/

# No servidor sem internet:
4. Executar:
   bash /tmp/install.sh \
     --activation-code "XXXX-XXXX-XXXX-XXXX" \
     --local-agent /tmp/iscope-agent-latest.tar.gz \
     --local-supervisor /tmp/iscope-supervisor-latest.tar.gz
```

### Detalhes Técnicos

- As variáveis `LOCAL_AGENT` e `LOCAL_SUPERVISOR` serão adicionadas nas linhas ~41-42
- No `parse_args`, dois novos cases: `--local-agent` e `--local-supervisor` com shift 2
- Na função `download_release`, um bloco condicional no início verifica se ambos os caminhos locais existem. Se sim, copia/extrai direto sem chamar `get_signed_url` nem `curl`
- O `usage()` será atualizado com as novas opções
- O mesmo será aplicado ao `super-agent-install/index.ts` para consistência

