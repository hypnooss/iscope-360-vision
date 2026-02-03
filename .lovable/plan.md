

# Plano: Habilitar AppStream Automaticamente no Script de Instalação

## Causa Raiz Identificada

O repositório **AppStream** está desabilitado no servidor. Este repositório contém os módulos Python necessários para instalação.

```
appstream    CentOS Stream 8 - AppStream    disabled
```

Após habilitar com `dnf config-manager --set-enabled appstream`, o Python 3.9 fica disponível.

---

## Alteração Necessária

### Arquivo: `supabase/functions/agent-install/index.ts`

**Função `install_deps()` - Adicionar habilitação do AppStream:**

Inserir antes de tentar instalar Python:

```bash
# Habilitar repositório AppStream (necessário para módulos Python)
echo "Habilitando repositório AppStream..."
dnf config-manager --set-enabled appstream 2>/dev/null || true
dnf config-manager --set-enabled powertools 2>/dev/null || true  # útil para -devel
```

---

## Código Completo da Seção DNF

```bash
if command -v dnf >/dev/null 2>&1; then
  # Instalar dependências básicas
  dnf install -y tar curl gcc openssl-devel libffi-devel || true
  
  # Instalar EPEL (útil para algumas distros)
  dnf install -y epel-release 2>/dev/null || true
  
  # Para CentOS 8 EOL (não Stream): apontar repos para vault
  if [[ -f /etc/centos-release ]] && grep -q "CentOS Linux.*8" /etc/centos-release 2>/dev/null; then
    echo "Detectado CentOS Linux 8 (EOL) - redirecionando repos para vault..."
    sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
    sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
    dnf clean all 2>/dev/null || true
  fi
  
  # NOVO: Habilitar repositório AppStream (contém módulos Python)
  echo "Habilitando repositório AppStream..."
  dnf config-manager --set-enabled appstream 2>/dev/null || true
  dnf config-manager --set-enabled powertools 2>/dev/null || true
  
  # Listar módulos Python disponíveis para debug
  echo "Módulos Python disponíveis:"
  dnf module list python* 2>/dev/null | head -20 || true
  
  # Tentar habilitar módulo python39 (CentOS/RHEL 8/Stream)
  echo "Habilitando módulo python39..."
  dnf module reset python39 -y 2>/dev/null || true
  dnf module enable python39:3.9 -y 2>/dev/null || dnf module enable python39 -y 2>/dev/null || true
  
  # Tentar habilitar módulo python38 como fallback
  dnf module reset python38 -y 2>/dev/null || true
  dnf module enable python38:3.8 -y 2>/dev/null || dnf module enable python38 -y 2>/dev/null || true
  
  # Instalar Python (múltiplos fallbacks)
  echo "Instalando Python..."
  dnf install -y python39 python39-pip python39-devel 2>/dev/null || \
  dnf install -y python3.9 python3.9-pip python3.9-devel 2>/dev/null || \
  dnf install -y python38 python38-pip python38-devel 2>/dev/null || \
  dnf install -y python3.8 python3.8-pip python3.8-devel 2>/dev/null || \
  dnf install -y python3 python3-pip python3-devel 2>/dev/null || \
  dnf install -y python36 python36-pip python36-devel 2>/dev/null || true
  
  # Verificar se Python foi instalado
  echo "Verificando Python instalado:"
  which python3 python3.9 python3.8 2>/dev/null || true
  
  return
fi
```

---

## Solução Imediata (Testar Agora)

Agora que o AppStream está habilitado, tente instalar o agente novamente:

```bash
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "G3RB-7LGP-90L7-WGWW"
```

Se ainda falhar, instale Python manualmente primeiro:

```bash
sudo dnf module enable python39:3.9 -y
sudo dnf install -y python39 python39-pip
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "G3RB-7LGP-90L7-WGWW"
```

---

## Resumo da Correção

| Problema | Solução |
|----------|---------|
| AppStream desabilitado | `dnf config-manager --set-enabled appstream` |
| Módulos Python não encontrados | Habilitar repo antes de listar módulos |
| Compatibilidade ampla | Adicionar PowerTools para pacotes -devel |

Esta alteração adiciona **2 linhas** ao script e resolve o problema de instalação em sistemas onde AppStream está desabilitado por padrão.

