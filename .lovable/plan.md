
# Plano: AutoUpdater com Verificacao e Instalacao Automatica de Componentes

## Resumo

Modificar o AutoUpdater para que, apos atualizar os arquivos Python, verifique automaticamente quais componentes do sistema estao faltando e os instale. Isso sera feito de forma generica, permitindo adicionar novos componentes no futuro sem precisar alterar a versao do agent.

---

## Arquitetura Proposta

O AutoUpdater tera um novo metodo `_ensure_system_components()` que executa apos `_update_dependencies()`:

```text
check_and_update()
    |
    v
1. Download pacote
2. Verificar checksum
3. Extrair e validar
4. Backup atual
5. Substituir arquivos
6. Atualizar dependencias pip
7. **NOVO: Verificar e instalar componentes do sistema**
8. Solicitar restart
```

---

## Sistema de Componentes

Cada componente tera:
- **check**: Funcao para verificar se esta instalado
- **install**: Funcao para instalar (comandos bash)

```text
Componentes Suportados (v1.2.1):
+-------------------+------------------------+-------------------------+
| Componente        | Verificacao            | Instalacao              |
+-------------------+------------------------+-------------------------+
| PowerShell Core   | which pwsh             | Microsoft repos         |
| Modulos M365      | pwsh -c Get-Module ... | Install-Module ...      |
| Certificado M365  | /var/lib/.../m365.crt  | openssl req -x509 ...   |
| Amass             | which amass            | Download GitHub release |
+-------------------+------------------------+-------------------------+
```

---

## Detalhes da Implementacao

### Arquivo: `python-agent/agent/updater.py`

**Adicionar novo metodo `_ensure_system_components()`**

Este metodo sera chamado apos `_update_dependencies()` e executara scripts bash para verificar e instalar componentes ausentes:

```python
def _ensure_system_components(self) -> None:
    """Check and install missing system components."""
    self.logger.info("Verificando componentes do sistema...")
    
    components = [
        ("PowerShell", self._check_powershell, self._install_powershell),
        ("Modulos M365", self._check_m365_modules, self._install_m365_modules),
        ("Certificado M365", self._check_m365_certificate, self._generate_m365_certificate),
    ]
    
    for name, check_fn, install_fn in components:
        if not check_fn():
            self.logger.info(f"Componente ausente: {name}. Instalando...")
            try:
                install_fn()
                self.logger.info(f"{name} instalado com sucesso")
            except Exception as e:
                self.logger.warning(f"Falha ao instalar {name}: {e}")
```

**Metodos de verificacao:**

```python
def _check_powershell(self) -> bool:
    """Check if PowerShell is installed."""
    return shutil.which("pwsh") is not None

def _check_m365_modules(self) -> bool:
    """Check if M365 PowerShell modules are installed."""
    if not self._check_powershell():
        return True  # Skip if no PowerShell
    
    result = subprocess.run(
        ["pwsh", "-NoProfile", "-Command", 
         "if (Get-Module -ListAvailable ExchangeOnlineManagement) { exit 0 } else { exit 1 }"],
        capture_output=True
    )
    return result.returncode == 0

def _check_m365_certificate(self) -> bool:
    """Check if M365 certificate exists."""
    cert_file = Path("/var/lib/iscope-agent/certs/m365.crt")
    return cert_file.exists()
```

**Metodos de instalacao:**

Os metodos de instalacao executarao comandos bash usando `subprocess.run()`. Como o updater roda como root (via systemd), tera permissao para instalar pacotes.

```python
def _install_powershell(self) -> None:
    """Install PowerShell Core based on OS detection."""
    # Detectar OS
    os_id = self._detect_os()
    
    if os_id in ("ubuntu", "debian"):
        # Usar apt-get
        subprocess.run(["apt-get", "install", "-y", "wget", "apt-transport-https"], ...)
        # Registrar Microsoft repo e instalar
        ...
    elif os_id in ("rhel", "centos", "rocky", "almalinux", "ol"):
        # Usar dnf/yum
        ...

def _install_m365_modules(self) -> None:
    """Install M365 PowerShell modules."""
    subprocess.run([
        "pwsh", "-NoProfile", "-NonInteractive", "-Command",
        "Install-Module -Name ExchangeOnlineManagement -Scope AllUsers -Force -AllowClobber; "
        "Install-Module -Name Microsoft.Graph.Authentication -Scope AllUsers -Force -AllowClobber"
    ], ...)

def _generate_m365_certificate(self) -> None:
    """Generate M365 certificate using openssl."""
    cert_dir = Path("/var/lib/iscope-agent/certs")
    cert_dir.mkdir(parents=True, exist_ok=True)
    
    subprocess.run([
        "openssl", "req", "-x509",
        "-newkey", "rsa:2048",
        "-keyout", str(cert_dir / "m365.key"),
        "-out", str(cert_dir / "m365.crt"),
        "-sha256", "-days", "730", "-nodes",
        "-subj", f"/CN=iScope-Agent-{hostname}/O=iScope 360"
    ], ...)
    
    # Calcular e salvar thumbprint
    ...
```

---

### Atualizacao do fluxo em `check_and_update()`

```python
def check_and_update(self, update_info: Dict[str, Any]) -> bool:
    # ... codigo existente ate linha 88 ...
    
    # 7. Reinstalar dependencias pip
    self._update_dependencies()
    
    # 8. NOVO: Verificar e instalar componentes do sistema
    self._ensure_system_components()
    
    self.logger.info(f"Update para {version} concluido com sucesso")
    
    # 9. Solicitar restart
    self._request_restart()
    
    return True
```

---

### Arquivo: `python-agent/agent/version.py`

Atualizar versao para 1.2.1:

```python
__version__ = "1.2.1"
```

---

## Consideracoes de Seguranca

1. **Execucao como root**: O agent roda como usuario `iscope`, mas o systemd tem `CAP_SYS_ADMIN`. Para instalar pacotes, precisamos que a instalacao de componentes seja feita com privilegios elevados.

2. **Solucao**: O metodo `_ensure_system_components()` verificara se tem permissao para instalar (uid 0). Se nao tiver, apenas logara um aviso.

---

## Fluxo Completo Apos Implementacao

```text
1. Admin publica versao 1.2.1
   |
   v
2. Agent recebe update_available no heartbeat
   |
   v
3. AutoUpdater baixa e atualiza arquivos Python
   |
   v
4. AutoUpdater executa _ensure_system_components():
   - Verifica PowerShell -> Instala se ausente
   - Verifica Modulos M365 -> Instala se ausente
   - Verifica Certificado -> Gera se ausente
   |
   v
5. Agent reinicia
   |
   v
6. Heartbeat reporta capabilities atualizadas
   |
   v
7. Certificado enviado no heartbeat (se pendente)
```

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `python-agent/agent/updater.py` | Adicionar `_ensure_system_components()` e metodos auxiliares |
| `python-agent/agent/version.py` | Atualizar para 1.2.1 |

---

## Extensibilidade Futura

A estrutura de componentes permite adicionar novos facilmente:

```python
# Para adicionar novo componente no futuro:
components = [
    ("PowerShell", self._check_powershell, self._install_powershell),
    ("Modulos M365", self._check_m365_modules, self._install_m365_modules),
    ("Certificado M365", self._check_m365_certificate, self._generate_m365_certificate),
    # Novos componentes:
    ("Docker", self._check_docker, self._install_docker),
    ("Kubectl", self._check_kubectl, self._install_kubectl),
]
```

---

## Proximos Passos Apos Aprovacao

1. Implementar as alteracoes no `updater.py`
2. Atualizar versao para 1.2.1
3. Gerar release `iscope-agent-1.2.1.tar.gz`
4. Upload para bucket `agent-releases`
5. Publicar via Admin > Configuracoes > Agents
6. Aguardar agents atualizarem automaticamente
7. Verificar que capabilities agora incluem `powershell` e `m365_powershell`
