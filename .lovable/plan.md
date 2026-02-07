

# Plano: Corrigir Formato do Certificado para Exchange Online

## Problema Identificado

O PowerShell `Connect-ExchangeOnline` com o parâmetro `-CertificateFilePath` espera um arquivo **PFX (PKCS#12)** que contém certificado + chave privada em um único arquivo. Atualmente, o agente gera:

- `/var/lib/iscope-agent/certs/m365.crt` (certificado público)
- `/var/lib/iscope-agent/certs/m365.key` (chave privada)

Mas o PowerShell não consegue usar arquivos separados:
```
The certificate certificate does not have a private key.
```

---

## Solução

Modificar dois arquivos para:
1. Gerar arquivo `.pfx` durante a criação do certificado
2. Usar o `.pfx` no PowerShellExecutor com a senha correta

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `python-agent/check-deps.sh` | Adicionar geração do arquivo `.pfx` |
| `python-agent/agent/executors/powershell.py` | Usar `.pfx` e incluir `-CertificatePassword` |

---

## Mudanças Detalhadas

### 1. `check-deps.sh` - Gerar PFX

Após gerar os arquivos `.crt` e `.key`, adicionar:

```bash
# Generate PFX file (for PowerShell compatibility)
# Use empty password for simplicity (protected by file permissions)
openssl pkcs12 \
    -export \
    -out "$CERT_DIR/m365.pfx" \
    -inkey "$CERT_DIR/m365.key" \
    -in "$CERT_DIR/m365.crt" \
    -passout pass: 2>/dev/null

if [[ -f "$CERT_DIR/m365.pfx" ]]; then
    chmod 600 "$CERT_DIR/m365.pfx"
    log "Arquivo PFX gerado para PowerShell"
fi
```

O arquivo terá senha vazia (protegido por permissões de arquivo), simplificando o uso.

### 2. `powershell.py` - Usar PFX

Atualizar a constante do caminho e adicionar `-CertificatePassword`:

```python
# Constantes atualizadas
PFX_FILE = CERT_DIR / "m365.pfx"

# Comando de conexão atualizado
MODULES = {
    "ExchangeOnline": {
        "import": "Import-Module ExchangeOnlineManagement -ErrorAction Stop",
        "connect": 'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword (ConvertTo-SecureString -String "" -AsPlainText -Force) -Organization "{organization}" -ShowBanner:$false',
        "disconnect": "Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue",
    },
    "MicrosoftGraph": {
        "import": "Import-Module Microsoft.Graph.Authentication -ErrorAction Stop",
        "connect": 'Connect-MgGraph -ClientId "{app_id}" -CertificateFilePath "{cert_path}" -TenantId "{tenant_id}" -NoWelcome',
        "disconnect": "Disconnect-MgGraph -ErrorAction SilentlyContinue",
    },
}
```

E atualizar `_build_script` para usar `PFX_FILE`:

```python
module_config["connect"].format(
    app_id=app_id,
    cert_path=str(self.PFX_FILE),  # Usar PFX em vez de CRT
    tenant_id=tenant_id,
    organization=organization
)
```

---

## Fluxo Após Correção

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  GERAÇÃO DO CERTIFICADO (check-deps.sh)                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  openssl req → m365.crt + m365.key                                        │
│       ↓                                                                    │
│  openssl pkcs12 -export → m365.pfx (cert+key combinados)                  │
│       ↓                                                                    │
│  chmod 600 m365.pfx (protegido por permissões)                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  EXECUÇÃO POWERSHELL (PowerShellExecutor)                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Connect-ExchangeOnline                                                    │
│    -AppId "xxx"                                                            │
│    -CertificateFilePath "/var/lib/iscope-agent/certs/m365.pfx"            │
│    -CertificatePassword (ConvertTo-SecureString "" -AsPlainText -Force)   │
│    -Organization "contoso.onmicrosoft.com"                                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Ação Manual Necessária

Após aplicar as mudanças, o operador precisa:

1. **Regenerar o certificado** no servidor do agente:
   ```bash
   sudo touch /var/lib/iscope-agent/check_components.flag
   sudo systemctl restart iscope-agent
   ```

2. **Verificar geração do PFX**:
   ```bash
   ls -la /var/lib/iscope-agent/certs/
   # Deve mostrar: m365.crt, m365.key, m365.pfx, m365.thumbprint
   ```

3. **Reenviar thumbprint** para o Azure (se necessário, caso o certificado tenha sido regerado)

---

## Resultado Esperado

```
Executing PowerShell ExchangeOnline commands: ['test_connection', 'organization_config']
PowerShell execution successful, 2 results
Tarefa ... finalizada: status=completed, tempo=...ms, completed=1, failed=0
```

