

# Plano: Adicionar Suporte a EPEL para CentOS 8 EOL

## Problema Identificado

O **CentOS 8 chegou ao EOL** em dezembro de 2021. Os repositórios padrão (AppStream) não têm mais o módulo `python39`:

```
Error: Problems in request:
missing groups or modules: python39
```

## Solução

Adicionar instalação do **EPEL (Extra Packages for Enterprise Linux)** que ainda mantém pacotes Python 3.9 para RHEL/CentOS 8.

---

## Alteração Necessária

### Arquivo: `supabase/functions/agent-install/index.ts`

**Função `install_deps()` - Adicionar instalação do EPEL antes do Python:**

```bash
if command -v dnf >/dev/null 2>&1; then
  # Instalar dependências básicas
  dnf install -y tar curl gcc openssl-devel libffi-devel || true
  
  # Instalar EPEL para CentOS/RHEL 8 (necessário após EOL)
  dnf install -y epel-release 2>/dev/null || true
  
  # Para CentOS 8 EOL: apontar repos para vault
  if [[ -f /etc/centos-release ]] && grep -q "CentOS.*8" /etc/centos-release 2>/dev/null; then
    sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
    sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*.repo 2>/dev/null || true
    dnf clean all 2>/dev/null || true
  fi
  
  # Tentar habilitar módulo python39 (se disponível)
  dnf module reset python39 -y 2>/dev/null || true
  dnf module enable python39 -y 2>/dev/null || true
  
  # Instalar Python (múltiplos fallbacks)
  dnf install -y python39 python39-pip python39-devel 2>/dev/null || \
  dnf install -y python3 python3-pip python3-devel 2>/dev/null || \
  dnf install -y python38 python38-pip python38-devel 2>/dev/null || true
  
  return
fi
```

---

## Solução Imediata (Manual no Servidor)

Execute no servidor para resolver agora:

```bash
# Corrigir repos do CentOS 8 EOL (apontar para vault)
sudo sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*.repo
sudo sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*.repo

# Limpar cache
sudo dnf clean all

# Instalar EPEL
sudo dnf install -y epel-release

# Agora instalar Python 3.9
sudo dnf install -y python39 python39-pip

# Rodar instalador novamente
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "G3RB-7LGP-90L7-WGWW"
```

---

## Por que isso acontece?

| Situação | Descrição |
|----------|-----------|
| CentOS 8 EOL | Suporte oficial terminou em 31/12/2021 |
| Repos migrados | Conteúdo movido de `mirror.centos.org` para `vault.centos.org` |
| EPEL | Repositório comunitário que ainda mantém pacotes para RHEL/CentOS |

---

## Consideração

Se este servidor precisar de suporte a longo prazo, recomendo migrar para:
- **AlmaLinux 8** (drop-in replacement para CentOS 8)
- **Rocky Linux 8** (outro fork do CentOS)
- **CentOS Stream 9** (rolling release)

