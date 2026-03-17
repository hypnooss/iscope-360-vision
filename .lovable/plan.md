

## Alinhar `components.py` com `check-deps.sh`

Três alterações cirúrgicas em `python-agent/agent/components.py`:

### 1. Adicionar constante `PFX_FILE` (linha 30)

```python
PFX_FILE = CERT_DIR / "m365.pfx"
```

### 2. Adicionar `-AcceptLicense` ao PnP.PowerShell (linha 239)

```python
"Install-Module -Name PnP.PowerShell -Scope AllUsers -Force -AllowClobber -AcceptLicense"
```

### 3. Verificar PFX na checagem do certificado (linha 258)

```python
if not self.CERT_FILE.exists() or not self.KEY_FILE.exists() or not self.PFX_FILE.exists():
    return False
```

### 4. Gerar PFX após CRT+KEY em `_generate_m365_certificate` (após linha 293)

Inserir antes do cálculo do thumbprint, logo após `os.chmod(self.CERT_FILE, 0o644)`:

```python
        # Gerar PFX para CBA com PnP.PowerShell (com fallback sem -legacy para OpenSSL < 3)
        try:
            subprocess.run([
                "openssl", "pkcs12", "-export",
                "-out", str(self.PFX_FILE),
                "-inkey", str(self.KEY_FILE),
                "-in", str(self.CERT_FILE),
                "-passout", "pass:",
                "-legacy"
            ], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            subprocess.run([
                "openssl", "pkcs12", "-export",
                "-out", str(self.PFX_FILE),
                "-inkey", str(self.KEY_FILE),
                "-in", str(self.CERT_FILE),
                "-passout", "pass:"
            ], check=True, capture_output=True)

        os.chmod(self.PFX_FILE, 0o600)
```

Isso replica a mesma lógica do `check-deps.sh`, garantindo que o PFX é gerado tanto pelo script shell (no boot via systemd) quanto pelo Python (durante updates via `updater.py`).

