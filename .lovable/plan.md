

# Plano: Corrigir Sintaxe de Senha Vazia no PowerShell

## Problema Identificado

O PowerShell rejeita strings vazias no `ConvertTo-SecureString`:
```
ConvertTo-SecureString -String "" -AsPlainText -Force
Cannot bind argument to parameter 'String' because it is an empty string.
```

---

## Solução

Usar `[System.Security.SecureString]::new()` para criar um SecureString vazio, que é a forma correta de representar uma senha em branco no PowerShell.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `python-agent/agent/executors/powershell.py` | Corrigir sintaxe do SecureString vazio |

---

## Mudança Detalhada

### `powershell.py` - Linha 28-29

**Antes:**
```python
"connect": 'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword (ConvertTo-SecureString -String "" -AsPlainText -Force) -Organization "{organization}" -ShowBanner:$false',
```

**Depois:**
```python
"connect": 'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -Organization "{organization}" -ShowBanner:$false',
```

O mesmo para MicrosoftGraph (linha 33):

**Antes:**
```python
"connect": 'Connect-MgGraph -ClientId "{app_id}" -CertificateFilePath "{cert_path}" -TenantId "{tenant_id}" -NoWelcome',
```

**Depois:**
```python
"connect": 'Connect-MgGraph -ClientId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -TenantId "{tenant_id}" -NoWelcome',
```

---

## Sintaxe PowerShell

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  ANTES (erro)                                                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ConvertTo-SecureString -String "" -AsPlainText -Force                    │
│       ↓                                                                    │
│  ERRO: Cannot bind argument to parameter 'String'                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  DEPOIS (correto)                                                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [System.Security.SecureString]::new()                                     │
│       ↓                                                                    │
│  Cria SecureString vazio (senha em branco válida)                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Ação Manual Após Implementação

Atualizar o arquivo no servidor do agente:

```bash
vi /opt/iscope-agent/agent/executors/powershell.py
# Substituir: ConvertTo-SecureString -String "" -AsPlainText -Force
# Por: [System.Security.SecureString]::new()

systemctl restart iscope-agent
```

Ou aguardar o próximo deploy do agente.

---

## Resultado Esperado

```
Executing PowerShell ExchangeOnline commands: ['test_connection', 'organization_config']
PowerShell execution successful, 2 results
Tarefa ... finalizada: status=completed, tempo=...ms, completed=1, failed=0
```

