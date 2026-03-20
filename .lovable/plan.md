

## Plano: Incluir requirements.txt no agent-fix

### Problema
O `agent-fix` deleta o `requirements.txt` na limpeza e nenhum tarball o inclui. Sem ele, o venv não é reconstruído.

### Correções

**1. `supabase/functions/agent-fix/index.ts`**
Adicionar `! -name 'requirements.txt'` ao comando `find ... -exec rm` para preservar o arquivo durante a limpeza. Além disso, adicionar um fallback que baixa o `requirements.txt` do storage caso ele não exista após a extração dos pacotes.

**2. Incluir `requirements.txt` no tarball do Agent**
O `requirements.txt` deve ser incluído no pacote `iscope-agent-latest.tar.gz` na raiz, para que ao extrair em `/opt/iscope-agent/` ele fique disponível. Isso requer regerar o pacote do agent.

**3. (Opcional) Boot-time dependency check no Supervisor**
Adicionar ao `supervisor/main.py` uma verificação no início: se `requirements.txt` existir e o venv existir, rodar `pip install -r requirements.txt` silenciosamente antes de iniciar o loop. Isso garante que novas dependências (como `websocket-client`) sejam instaladas automaticamente mesmo sem um update formal.

### Arquivos a alterar
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-fix/index.ts` | Preservar `requirements.txt` na limpeza + fallback download |
| `python-agent/supervisor/main.py` | Verificação de dependências no boot |

