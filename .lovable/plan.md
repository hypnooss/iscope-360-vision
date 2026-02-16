

# Corrigir instalacao do Super Agent em Ubuntu 20.04 (Python 3.8)

## Problema

Ubuntu 20.04 (Focal) vem com Python 3.8 como `python3` padrao. A funcao `install_deps` do instalador so instala `python3` via apt-get, que no Focal resolve para 3.8. Depois, `require_python_min_version` falha com:

```
Erro: Python >= 3.9 e obrigatorio. Detectado: 3.8 (python3.8)
```

## Solucao

Alterar a funcao `install_deps` no bloco apt-get para tambem instalar `python3.9` e `python3.9-venv` quando disponiveis. No Ubuntu 20.04, o Python 3.9 esta disponivel no repositorio `universe` como pacote separado. A funcao `choose_python` ja prioriza `python3.11 > python3.10 > python3.9`, entao basta garantir que o pacote esteja instalado.

## Detalhes tecnicos

### Arquivo a modificar

`supabase/functions/super-agent-install/index.ts`

### Mudanca na funcao `install_deps` (bloco apt-get, linhas 162-166)

**Antes:**
```bash
apt-get update -y
apt-get install -y tar curl python3 python3-venv python3-pip build-essential libssl-dev libffi-dev
```

**Depois:**
```bash
apt-get update -y
apt-get install -y tar curl python3 python3-venv python3-pip build-essential libssl-dev libffi-dev

# Tentar instalar Python 3.9+ se o python3 padrao for < 3.9 (ex: Ubuntu 20.04)
local py3_ver
py3_ver="$(python3 -c 'import sys; print(sys.version_info[1])' 2>/dev/null || echo 0)"
if [[ "$py3_ver" -lt 9 ]]; then
  echo "Python 3 padrao e 3.$py3_ver. Tentando instalar Python 3.9+..."
  apt-get install -y software-properties-common || true
  add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
  apt-get update -y
  apt-get install -y python3.9 python3.9-venv python3.9-distutils || true
fi
```

Isso adiciona o PPA `deadsnakes` (repositorio confiavel e amplamente usado para versoes alternativas de Python no Ubuntu) e instala Python 3.9 com suporte a venv. A funcao `choose_python` ja existente vai detectar `python3.9` automaticamente na proxima etapa.

| Arquivo | Acao |
|---|---|
| `supabase/functions/super-agent-install/index.ts` | Modificar bloco apt-get do `install_deps` para instalar Python 3.9 quando o padrao for < 3.9 |

