

## Fix: Suporte a Python 3.9+ no CentOS 7

### Problema

O servidor é **CentOS 7**, que só tem Python 3.6 nos repos padrão. Os pacotes `python39`/`python39-pip` não existem no CentOS 7 (só no CentOS 8+ via AppStream). O instalador falha na etapa de criar o venv.

### Solução

Atualizar a função `install_system_deps()` no `supabase/functions/agent-install/index.ts` para detectar CentOS 7 e instalar Python 3.9 via **IUS Repository** (repositório comunitário confiável para RHEL/CentOS 7):

```bash
# Dentro do bloco "if command -v yum" (CentOS 7)
# 1. Detectar CentOS/RHEL 7
# 2. Adicionar IUS repo: yum install -y https://repo.ius.io/ius-release-el7.rpm
# 3. Instalar: yum install -y python39 python39-pip python39-devel
#    (no IUS, os pacotes se chamam python39 mesmo)
# 4. Fallback: compilar do source se IUS falhar
```

### Mudança em `supabase/functions/agent-install/index.ts`

No bloco `yum` (linhas 228-232), substituir por:

```bash
if command -v yum >/dev/null 2>&1; then
  yum install -y tar curl gcc openssl-devel libffi-devel || true
  
  # Detectar versão do OS
  local os_major=""
  if [[ -f /etc/os-release ]]; then
    os_major=$(. /etc/os-release && echo "${VERSION_ID%%.*}")
  elif [[ -f /etc/centos-release ]]; then
    os_major=$(grep -oP '(?<=release )\d' /etc/centos-release)
  fi
  
  if [[ "$os_major" == "7" ]]; then
    echo "CentOS/RHEL 7 detectado — adicionando repositório IUS..."
    yum install -y https://repo.ius.io/ius-release-el7.rpm 2>/dev/null || true
    yum install -y python39 python39-pip python39-devel 2>/dev/null || \
    yum install -y python3 python3-pip python3-devel 2>/dev/null || true
    
    # Fallback: compilar Python 3.9 do source
    if ! command -v python3.9 >/dev/null 2>&1 && ! python3 -c 'import sys; assert sys.version_info >= (3,9)' 2>/dev/null; then
      echo "Compilando Python 3.9 do source (pode levar alguns minutos)..."
      yum install -y gcc make zlib-devel bzip2-devel readline-devel sqlite-devel wget || true
      local py_src="/tmp/Python-3.9.18"
      wget -q "https://www.python.org/ftp/python/3.9.18/Python-3.9.18.tgz" -O /tmp/python3.tgz
      tar xzf /tmp/python3.tgz -C /tmp
      cd "$py_src" && ./configure --enable-optimizations --prefix=/usr/local 2>&1 | tail -5
      make -j$(nproc) 2>&1 | tail -5
      make altinstall
      cd /
      rm -rf "$py_src" /tmp/python3.tgz
    fi
  else
    yum install -y python39 python39-pip python39-devel || true
    yum install -y python3 python3-pip python3-devel || true
  fi
  return
fi
```

### Arquivo a modificar

`supabase/functions/agent-install/index.ts` — bloco `yum` dentro de `install_system_deps()` (linhas 228-232).

Após editar, fazer deploy da edge function.

