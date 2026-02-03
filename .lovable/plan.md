
# Plano: Corrigir Instalação do Python no CentOS 8

## Problema Identificado

No **CentOS 8**, o Python 3.9+ requer habilitação do módulo AppStream antes da instalação:

```
No match for argument: python39
No match for argument: python39-pip
```

O script atual tenta `dnf install -y python39` diretamente, mas no CentOS 8 é necessário:
1. Habilitar o módulo: `dnf module enable python39 -y`
2. Depois instalar: `dnf install python39 python39-pip -y`

---

## Alteração Necessária

### Arquivo: `supabase/functions/agent-install/index.ts`

**Função `install_deps()`** - Adicionar suporte a módulos do CentOS/RHEL 8:

**De (linhas 170-176):**
```bash
if command -v dnf >/dev/null 2>&1; then
  # OL/RHEL-like: prefer python39+ to avoid EOL Python 3.6 issues
  dnf install -y tar curl gcc openssl-devel libffi-devel || true
  dnf install -y python39 python39-pip python39-devel || true
  dnf install -y python3 python3-pip python3-devel || true
  return
fi
```

**Para:**
```bash
if command -v dnf >/dev/null 2>&1; then
  # OL/RHEL/CentOS 8+: habilitar módulo Python 3.9 antes de instalar
  dnf install -y tar curl gcc openssl-devel libffi-devel || true
  
  # Tentar habilitar módulo python39 (CentOS/RHEL 8)
  dnf module reset python39 -y 2>/dev/null || true
  dnf module enable python39 -y 2>/dev/null || true
  
  # Instalar Python (com fallback)
  dnf install -y python39 python39-pip python39-devel 2>/dev/null || \
  dnf install -y python3.9 python3.9-pip python3.9-devel 2>/dev/null || \
  dnf install -y python3 python3-pip python3-devel || true
  
  return
fi
```

---

## Solução Imediata (Manual no Servidor)

Enquanto o deploy não é feito, execute manualmente no servidor:

```bash
# Habilitar módulo Python 3.9
sudo dnf module reset python39 -y
sudo dnf module enable python39 -y

# Instalar Python
sudo dnf install -y python39 python39-pip

# Rodar instalador novamente
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "G3RB-7LGP-90L7-WGWW"
```

---

## Detalhes Técnicos

| Distro | Método |
|--------|--------|
| Ubuntu/Debian | `apt-get install python3` |
| CentOS 8/RHEL 8 | `dnf module enable python39` + `dnf install python39` |
| Oracle Linux 8 | Mesmo do CentOS 8 |
| Fedora | `dnf install python3` (direto) |

O comando `dnf module reset/enable` é ignorado silenciosamente em distros que não usam módulos (como Fedora), então é seguro adicionar.
