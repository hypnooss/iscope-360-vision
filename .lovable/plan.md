
# Plano: Correção do Erro de Certificados CA no Agent

## Problema Identificado

O agent está falhando com o erro:
```
OSError: Could not find a suitable TLS CA certificate bundle, invalid path: 
/opt/iscope-agent/venv/lib64/python3.9/site-packages/certifi/cacert.pem
```

Isso ocorre porque a versão mais recente do `certifi` (2026.1.4) foi instalada, mas o arquivo `cacert.pem` não está presente no pacote. Este é um problema conhecido que pode acontecer por:
- Incompatibilidade com certas versões do Python/pip
- Cache corrompido (mesmo com `--no-cache-dir`)
- Bug específico da versão

## Solução Proposta

### 1. Fixar versão estável do certifi no requirements.txt

Adicionar uma versão específica conhecida e estável do `certifi`:

| Antes | Depois |
|-------|--------|
| (não especificado) | `certifi>=2024.2.2,<2026.0.0` |

Nota: O `certifi` é dependência transitiva do `requests`, então precisamos explicitá-lo para controlar a versão.

### 2. Adicionar fallback para certificados do sistema no script de instalação

Modificar o script `agent-install` para verificar se o `cacert.pem` existe após a instalação e, se não existir, criar um link simbólico para os certificados do sistema:

```bash
# Verificar se certifi foi instalado corretamente
certifi_pem="$INSTALL_DIR/venv/lib/python*/site-packages/certifi/cacert.pem"
if ! compgen -G "$certifi_pem" >/dev/null 2>&1; then
  echo "Aviso: cacert.pem não encontrado. Criando link para certificados do sistema..."
  
  # Caminhos comuns para CA bundle do sistema
  system_ca=""
  for ca_path in \
    /etc/ssl/certs/ca-certificates.crt \
    /etc/pki/tls/certs/ca-bundle.crt \
    /etc/ssl/ca-bundle.pem \
    /etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem; do
    if [[ -f "$ca_path" ]]; then
      system_ca="$ca_path"
      break
    fi
  done
  
  if [[ -n "$system_ca" ]]; then
    # Encontrar diretório do certifi e criar link
    certifi_dir=$(find "$INSTALL_DIR/venv" -type d -name certifi | head -1)
    if [[ -n "$certifi_dir" ]]; then
      ln -sf "$system_ca" "$certifi_dir/cacert.pem"
      echo "Link criado: $certifi_dir/cacert.pem -> $system_ca"
    fi
  fi
fi
```

### 3. Adicionar verificação de conectividade após setup

Adicionar um teste simples no final da instalação para validar que o TLS está funcionando:

```bash
verify_tls() {
  echo "Verificando conectividade TLS..."
  if "$INSTALL_DIR/venv/bin/python" -c "import requests; requests.get('https://httpbin.org/get', timeout=10)" 2>/dev/null; then
    echo "Conectividade TLS OK"
  else
    echo "Aviso: Falha no teste de TLS. Verificando certificados..."
    # Tentar fix automático
    fix_certifi_bundle
  fi
}
```

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `python-agent/requirements.txt` | EDIT | Adicionar versão específica do certifi |
| `supabase/functions/agent-install/index.ts` | EDIT | Adicionar fallback para CA do sistema e verificação TLS |

## Detalhes Técnicos

### requirements.txt atualizado

```
requests>=2.31.0
certifi>=2024.2.2,<2026.0.0
pyjwt>=2.8.0
python-dotenv>=1.0.1
schedule>=1.2.1
paramiko>=3.4.0
pysnmp>=6.0.0
urllib3>=2.0.0
dnspython>=2.7.0
```

### Lógica de fallback no script de instalação

A função `fix_certifi_bundle()` será chamada após `setup_venv()` e fará:

1. Verificar se `cacert.pem` existe no pacote certifi
2. Se não existir, procurar o CA bundle do sistema em caminhos conhecidos:
   - Debian/Ubuntu: `/etc/ssl/certs/ca-certificates.crt`
   - RHEL/CentOS: `/etc/pki/tls/certs/ca-bundle.crt`
   - Alternativas: `/etc/ssl/ca-bundle.pem`, `/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem`
3. Criar link simbólico do CA do sistema para `cacert.pem`
4. Testar conectividade com uma request HTTPS simples

## Correção Imediata (Manual)

Para corrigir o agent já instalado sem precisar reinstalar:

```bash
# Encontrar o CA bundle do sistema
CA_BUNDLE=$(cat /etc/ssl/certs/ca-certificates.crt 2>/dev/null && echo "/etc/ssl/certs/ca-certificates.crt" || \
            cat /etc/pki/tls/certs/ca-bundle.crt 2>/dev/null && echo "/etc/pki/tls/certs/ca-bundle.crt")

# Encontrar diretório do certifi
CERTIFI_DIR=$(find /opt/iscope-agent/venv -type d -name certifi | head -1)

# Criar link simbólico
if [[ -n "$CERTIFI_DIR" ]] && [[ -n "$CA_BUNDLE" ]]; then
  ln -sf "$CA_BUNDLE" "$CERTIFI_DIR/cacert.pem"
  echo "Link criado: $CERTIFI_DIR/cacert.pem"
  systemctl restart iscope-agent
fi
```

Ou de forma mais simples:

```bash
# Para RHEL/CentOS:
ln -sf /etc/pki/tls/certs/ca-bundle.crt \
  /opt/iscope-agent/venv/lib64/python3.9/site-packages/certifi/cacert.pem

systemctl restart iscope-agent
```
