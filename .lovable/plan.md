
# Plano: Automatizar Setup de Exchange RBAC via Agent

## Análise do Problema

O `PowerShellExecutor` atual só suporta conexão via **certificado (CBA)**:

```python
# powershell.py linha 32
'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" ...'
```

Para registrar o Service Principal no Exchange, precisamos de uma conexão com **credenciais de admin** (usuário Global Admin ou Exchange Admin do tenant cliente). É um problema de "galinha ou ovo":

1. CBA precisa do Service Principal registrado no Exchange
2. Para registrar, precisamos de credenciais de admin
3. Após registrado, CBA funciona

## Solução Proposta

Adicionar um **modo de conexão com credenciais de usuário** ao executor PowerShell, usado apenas para o setup inicial do RBAC.

### Fluxo Proposto

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE SETUP                              │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Admin conecta tenant (Admin Consent) ✅                          │
│ 2. Sistema detecta que Exchange RBAC não está configurado           │
│ 3. UI solicita credenciais do admin (email/senha ou OAuth)          │
│ 4. Sistema cria task PowerShell para Agent com credenciais          │
│ 5. Agent executa setup RBAC usando credenciais do admin             │
│ 6. Sistema marca RBAC como configurado                              │
│ 7. Próximas análises usam CBA normalmente                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

### 1. `python-agent/agent/executors/powershell.py`

Adicionar suporte para conexão com credenciais de usuário (Basic Auth ou Device Code):

```python
MODULES = {
    "ExchangeOnline": {
        "import": "Import-Module ExchangeOnlineManagement -ErrorAction Stop",
        # Conexão CBA (atual)
        "connect_cba": 'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" ...',
        # NOVO: Conexão com credenciais de usuário
        "connect_credential": 'Connect-ExchangeOnline -Credential $cred -ShowBanner:$false',
        "disconnect": "Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue",
    },
    # ...
}
```

Novo método para construir script com credenciais:

```python
def _build_credential_script(
    self,
    username: str,
    password: str,  # Será descriptografada antes de passar
    commands: List[Dict[str, Any]]
) -> str:
    script_parts = [
        "$ErrorActionPreference = 'Stop'",
        "$ProgressPreference = 'SilentlyContinue'",
        "",
        "# Create credential object",
        f'$secPassword = ConvertTo-SecureString "{password}" -AsPlainText -Force',
        f'$cred = New-Object System.Management.Automation.PSCredential("{username}", $secPassword)',
        "",
        "# Import and connect",
        "Import-Module ExchangeOnlineManagement -ErrorAction Stop",
        "Connect-ExchangeOnline -Credential $cred -ShowBanner:$false",
        "",
        # ... resto do script
    ]
```

### 2. Nova Edge Function: `setup-exchange-rbac/index.ts`

Cria uma task PowerShell para o Agent com os comandos de setup:

```typescript
// Task payload para o Agent
const setupCommands = [
  {
    name: "register_service_principal",
    command: `New-ServicePrincipal -AppId "${appId}" -ObjectId "${spObjectId}" -DisplayName "iScope Security"`,
  },
  {
    name: "assign_role",
    command: `New-ManagementRoleAssignment -App "${appId}" -Role "Exchange Recipient Administrator"`,
  },
];

// Criar task para o agent vinculado ao tenant
await supabase.from('tasks').insert({
  agent_id: linkedAgentId,
  type: 'exchange_rbac_setup',
  payload: {
    module: 'ExchangeOnline',
    auth_mode: 'credential',  // NOVO: indica uso de credenciais
    username: adminEmail,      // Do form UI
    password_encrypted: encryptedPassword,  // Criptografada
    commands: setupCommands,
  },
  status: 'pending',
});
```

### 3. `src/components/m365/ExchangeRBACSetupCard.tsx`

Adicionar formulário para coletar credenciais do admin:

```tsx
// Formulário para credenciais do admin
<form onSubmit={handleSubmit}>
  <Input
    type="email"
    placeholder="admin@contoso.com"
    value={adminEmail}
    onChange={(e) => setAdminEmail(e.target.value)}
  />
  <PasswordInput
    placeholder="Senha"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />
  <Button type="submit">
    Configurar Automaticamente
  </Button>
</form>
```

### 4. `src/components/m365/TenantStatusCard.tsx`

Integrar o formulário quando Exchange RBAC estiver pendente e tenant tiver Agent vinculado.

## Considerações de Segurança

1. **Senha nunca é armazenada** - Apenas usada uma vez para a task
2. **Criptografia em trânsito** - Senha criptografada antes de enviar ao backend
3. **Task de uso único** - Após execução, credenciais são descartadas
4. **Alternativa**: Usar Device Code Flow (mais seguro, sem senha)

## Alternativa: Device Code Flow

Invés de pedir senha, usar Device Code:

1. Sistema gera código de dispositivo
2. Admin abre link e autentica no navegador
3. Agent usa o token recebido para conectar

Isso é mais seguro mas requer implementação adicional no Agent.

## Resumo de Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `python-agent/agent/executors/powershell.py` | Modificar | Adicionar suporte a conexão com credenciais |
| `supabase/functions/setup-exchange-rbac/index.ts` | Criar | Edge function para criar task de setup |
| `src/components/m365/ExchangeRBACSetupCard.tsx` | Modificar | Adicionar form de credenciais |
| `src/components/m365/TenantStatusCard.tsx` | Modificar | Integrar novo fluxo |

## Resultado Esperado

1. Admin conecta tenant via Admin Consent
2. Sistema detecta Exchange RBAC pendente
3. UI exibe formulário solicitando email/senha do admin
4. Admin preenche e clica "Configurar"
5. Sistema cria task para Agent
6. Agent executa setup automaticamente
7. Sistema valida e marca como concluído
8. Próximas análises PowerShell funcionam via CBA
