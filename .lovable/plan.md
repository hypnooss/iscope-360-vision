

## Plano: Suporte a Python via SCL no agent-fix, agent-install e super-agent-install

### Problema
O CentOS 7 com SCL instala Python 3.8 em `/opt/rh/rh-python38/root/usr/bin/python3.8`, fora do PATH. A funcao `choose_python()` so verifica o PATH padrao, entao nao encontra o Python instalado via SCL.

### Solucao
Atualizar `choose_python()` nos 3 scripts para tambem verificar caminhos SCL conhecidos:

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/agent-fix/index.ts` | Expandir `choose_python()` com caminhos SCL |
| `supabase/functions/agent-install/index.ts` | Idem |
| `supabase/functions/super-agent-install/index.ts` | Idem |

### Detalhe tecnico

A funcao `choose_python()` passara a verificar, alem dos candidatos no PATH, os seguintes caminhos absolutos SCL:

```
/opt/rh/rh-python38/root/usr/bin/python3.8
/opt/rh/rh-python39/root/usr/bin/python3.9
/opt/rh/rh-python311/root/usr/bin/python3.11
```

Se encontrar um desses, usara o caminho absoluto como `PYTHON_BIN`. Isso resolve o problema sem precisar ativar o SCL (`scl enable`), ja que o venv e criado com o caminho direto do binario.

