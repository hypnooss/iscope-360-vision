

# Plano: Corrigir Instalação Python no CentOS Stream 8

## Problema Identificado

O servidor está rodando **CentOS Stream 8** (não CentOS 8 EOL). Os pacotes Python existem, mas:

1. No CentOS Stream 8, `python39` está disponível via **módulo AppStream**, não via EPEL
2. O módulo precisa ser habilitado **antes** de tentar instalar
3. Os nomes dos pacotes podem variar: `python39`, `python3.9`, `python38`, etc.

**Output revelador:**
```
CentOS Stream 8 - BaseOS   ← É CentOS Stream, não CentOS 8 regular!
```

---

## Solução

Reescrever a lógica de instalação do Python no script para:

1. **Detectar CentOS Stream** separadamente do CentOS 8 EOL
2. **Habilitar módulo python39** corretamente antes de instalar
3. **Usar nomes alternativos** de pacotes (`python3.9` além de `python39`)
4. **Verificar se Python já existe** antes de tentar instalar

---

## Alteração Necessária

### Arquivo: `supabase/functions/agent-install/index.ts`

**Função `install_deps()` - Nova lógica para dnf:**

```bash
if command -v dnf >/dev/null 2>&1; then
  # Instalar dependências básicas
  dnf install -y tar curl gcc openssl-devel libffi-devel || true
  
  # Instalar EPEL (útil para algumas distros)
  dnf install -y epel-release 2>/dev/null || true
  
  # Para CentOS 8 EOL (não Stream): apontar repos para vault
  if [[ -f /etc/centos-release ]] && grep -q "CentOS Linux.*8" /etc/centos-release 2>/dev/null; then
    sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
    sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
    dnf clean all 2>/dev/null || true
  fi
  
  # Listar módulos disponíveis para debug
  echo "Módulos Python disponíveis:"
  dnf module list python* 2>/dev/null | head -20 || true
  
  # Tentar habilitar módulo python39 (CentOS/RHEL 8/Stream)
  dnf module reset python39 -y 2>/dev/null || true
  dnf module enable python39 -y 2>/dev/null || true
  
  # Tentar habilitar módulo python38 como fallback
  dnf module reset python38 -y 2>/dev/null || true
  dnf module enable python38 -y 2>/dev/null || true
  
  # Instalar Python (múltiplos fallbacks com nomes alternativos)
  dnf install -y python39 python39-pip python39-devel 2>/dev/null || \
  dnf install -y python3.9 python3.9-pip python3.9-devel 2>/dev/null || \
  dnf install -y python38 python38-pip python38-devel 2>/dev/null || \
  dnf install -y python3.8 python3.8-pip python3.8-devel 2>/dev/null || \
  dnf install -y python3 python3-pip python3-devel 2>/dev/null || \
  dnf install -y python36 python36-pip python36-devel 2>/dev/null || true
  
  return
fi
```

---

## Debug Imediato (Executar no Servidor)

Por favor, execute estes comandos para investigar:

```bash
# Ver qual Python já está instalado
which python3 python3.8 python3.9 2>/dev/null

# Listar módulos Python disponíveis
sudo dnf module list python*

# Ver detalhes do módulo python39
sudo dnf module info python39

# Tentar habilitar e instalar passo a passo
sudo dnf module reset python39 -y
sudo dnf module enable python39:3.9 -y
sudo dnf install -y python39 python39-pip
```

**Importante:** O output de `dnf module list python*` vai mostrar exatamente quais versões estão disponíveis e como instalá-las.

---

## Por que isso acontece?

| Distro | Como instalar Python 3.9 |
|--------|--------------------------|
| CentOS 8 EOL | EPEL + vault repos |
| CentOS Stream 8 | `dnf module enable python39` + `dnf install python39` |
| RHEL 8 | Mesmo do Stream |
| Fedora | `dnf install python3` direto |

O script atual não diferencia entre **CentOS Linux 8** (EOL) e **CentOS Stream 8** (ainda suportado).

---

## Mudança na Detecção

Atual:
```bash
grep -q "CentOS.*8" /etc/centos-release
```

Proposto:
```bash
# CentOS Linux 8 (EOL) - precisa vault
grep -q "CentOS Linux.*8" /etc/centos-release

# CentOS Stream 8 - usar módulos AppStream
grep -q "CentOS Stream" /etc/centos-release
```

