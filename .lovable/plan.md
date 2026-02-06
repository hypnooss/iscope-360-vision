

# Plano: Conexão M365 via PowerShell com Certificado Transparente

## Objetivo

Implementar suporte a PowerShell no Agent para comandos M365 que não estão disponíveis via Graph API, com geração automática de certificados X.509 de forma transparente para o usuário.

---

## Análise da Arquitetura Atual

### Fluxo de Conexão M365 (Graph API)
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL - GRAPH API (REST)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [Usuário]                                                                 │
│      │                                                                      │
│      ▼                                                                      │
│   [TenantConnectionWizard] ──► [m365_tenants] (pending)                     │
│      │                                                                      │
│      ▼                                                                      │
│   [Microsoft Admin Consent] ──► App Multi-Tenant (client_secret)            │
│      │                                                                      │
│      ▼                                                                      │
│   [m365-oauth-callback] ──► [m365_tokens] (access_token, refresh_token)     │
│      │                                                                      │
│      ▼                                                                      │
│   [Edge Functions] ──► Graph API REST                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Armazenamento Atual
| Tabela | Conteúdo |
|--------|----------|
| `m365_global_config` | App ID + Client Secret (criptografado) |
| `m365_tenants` | Registros de conexão por cliente |
| `m365_tokens` | Access/Refresh tokens OAuth (criptografados) |
| `agents` | Configuração de agents Python |

---

## Problema: PowerShell Requer Certificado

### Por que Graph API não é suficiente?
| Recurso | Graph API | PowerShell |
|---------|-----------|------------|
| Exchange Transport Rules | Limitado | Connect-ExchangeOnline |
| DLP Policies | Não disponível | Get-DlpPolicy |
| Compliance Search | Limitado | Search-Mailbox |
| Advanced Audit Logs | Parcial | Search-UnifiedAuditLog |
| Message Trace | Não disponível | Get-MessageTrace |

### Autenticação PowerShell
- **Client Secret**: Funciona para Graph, mas NÃO para Exchange Online V3
- **Certificado X.509**: Obrigatório para `Connect-ExchangeOnline` com App-Only

---

## Solução Proposta: Geração Automática de Certificado

### Fluxo Completo
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NOVO FLUXO - COM POWERSHELL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. INSTALAÇÃO DO AGENT (já existente)                                     │
│   ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│   curl ... | bash  ──►  Agent instalado + Certificado gerado                │
│                              │                                              │
│                              ▼                                              │
│                    /var/lib/iscope-agent/certs/                             │
│                    ├── m365.key (privado, 600)                              │
│                    └── m365.crt (público)                                   │
│                              │                                              │
│                              ▼                                              │
│                    Thumbprint enviado no registro                           │
│                                                                             │
│   2. CONEXÃO DO TENANT (nova etapa)                                         │
│   ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│   [TenantConnectionWizard]                                                  │
│          │                                                                  │
│          ▼                                                                  │
│   Nova Etapa: "Selecionar Agent"                                            │
│   (Lista agents com certificado disponível)                                 │
│          │                                                                  │
│          ▼                                                                  │
│   [Instruções] "Faça upload do certificado no Azure"                        │
│   [Download] m365_agent_<id>.crt                                            │
│          │                                                                  │
│          ▼                                                                  │
│   [Microsoft Admin Consent] (igual ao atual)                                │
│          │                                                                  │
│          ▼                                                                  │
│   Tenant conectado + Agent vinculado                                        │
│                                                                             │
│   3. EXECUÇÃO DE ANÁLISE                                                    │
│   ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│   [Trigger Analysis]                                                        │
│          │                                                                  │
│          ▼                                                                  │
│   [agent_tasks] ──►  Task com tipo "m365_powershell"                        │
│          │                                                                  │
│          ▼                                                                  │
│   [Python Agent]                                                            │
│          │                                                                  │
│          ▼                                                                  │
│   [PowerShellExecutor] ──► pwsh + ExchangeOnlineManagement                  │
│          │                    (usando certificado local)                    │
│          ▼                                                                  │
│   [agent-step-result] ──► Dados coletados                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação em Etapas

### Etapa 1: Geração de Certificado no Script de Instalação

**Modificar:** `supabase/functions/agent-install/index.ts`

```bash
# Após criar diretórios
CERT_DIR="/var/lib/iscope-agent/certs"
mkdir -p "$CERT_DIR"

# Gerar certificado auto-assinado (válido por 2 anos)
if [[ ! -f "$CERT_DIR/m365.crt" ]]; then
  echo "Gerando certificado para autenticação M365..."
  
  openssl req -x509 \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/m365.key" \
    -out "$CERT_DIR/m365.crt" \
    -sha256 \
    -days 730 \
    -nodes \
    -subj "/CN=iScope-Agent-$(hostname)/O=iScope 360"
    
  # Permissões restritas
  chmod 600 "$CERT_DIR/m365.key"
  chmod 644 "$CERT_DIR/m365.crt"
  
  # Calcular thumbprint
  THUMBPRINT=$(openssl x509 -in "$CERT_DIR/m365.crt" -noout -fingerprint -sha1 | \
    sed 's/SHA1 Fingerprint=//' | sed 's/://g')
  
  echo "Certificado gerado: $CERT_DIR/m365.crt"
  echo "Thumbprint: $THUMBPRINT"
  
  # Salvar thumbprint para registro
  echo "$THUMBPRINT" > "$CERT_DIR/thumbprint.txt"
fi
```

### Etapa 2: Atualizar Registro do Agent

**Modificar:** `supabase/functions/register-agent/index.ts`

```typescript
// Adicionar campos ao registro
interface RegisterRequest {
  activation_code: string;
  certificate_thumbprint?: string;  // Novo campo
  capabilities?: string[];          // ['powershell', 'ssh', 'snmp']
}

// Armazenar thumbprint na tabela agents
await supabase.from('agents').update({
  jwt_secret: jwtSecret,
  certificate_thumbprint: body.certificate_thumbprint,  // Novo
  capabilities: body.capabilities,                       // Novo
  // ...
}).eq('id', agent.id);
```

**Migração SQL:**
```sql
ALTER TABLE agents 
ADD COLUMN certificate_thumbprint TEXT,
ADD COLUMN certificate_public_key TEXT,
ADD COLUMN capabilities JSONB DEFAULT '[]'::jsonb;
```

### Etapa 3: Enviar Thumbprint no Registro

**Modificar:** `python-agent/agent/auth.py`

```python
def register(self):
    # Ler thumbprint se existir
    thumbprint = None
    cert_path = Path("/var/lib/iscope-agent/certs/thumbprint.txt")
    if cert_path.exists():
        thumbprint = cert_path.read_text().strip()
    
    response = self.api.post("/register-agent", json={
        "activation_code": activation_code,
        "certificate_thumbprint": thumbprint,
        "capabilities": ["powershell", "ssh", "snmp", "http"],
    })
```

### Etapa 4: Criar PowerShellExecutor

**Novo arquivo:** `python-agent/agent/executors/powershell.py`

```python
class PowerShellExecutor(BaseExecutor):
    """Executa comandos PowerShell para M365."""
    
    def __init__(self, logger):
        super().__init__(logger)
        self.cert_path = Path("/var/lib/iscope-agent/certs/m365.crt")
        self.key_path = Path("/var/lib/iscope-agent/certs/m365.key")
    
    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executa script PowerShell com autenticação via certificado.
        
        step = {
            "executor": "powershell",
            "params": {
                "module": "ExchangeOnline",
                "commands": ["Get-TransportRule", "Get-DlpPolicy"],
                "app_id": "<app_id>",
                "tenant_id": "<tenant_id>",
            }
        }
        """
        params = step.get("params", {})
        app_id = params.get("app_id") or context.get("app_id")
        tenant_id = params.get("tenant_id") or context.get("tenant_id")
        commands = params.get("commands", [])
        
        # Montar script PowerShell
        script = self._build_script(app_id, tenant_id, commands)
        
        # Executar via pwsh
        result = subprocess.run(
            ["pwsh", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True,
            text=True,
            timeout=300,
        )
        
        if result.returncode != 0:
            return {"error": result.stderr}
        
        return {"data": json.loads(result.stdout)}
    
    def _build_script(self, app_id, tenant_id, commands):
        return f'''
$ErrorActionPreference = "Stop"
Import-Module ExchangeOnlineManagement

Connect-ExchangeOnline `
    -AppId "{app_id}" `
    -CertificateFilePath "{self.cert_path}" `
    -Organization "{tenant_id}.onmicrosoft.com" `
    -ShowBanner:$false

$results = @{{}}

{self._generate_command_blocks(commands)}

Disconnect-ExchangeOnline -Confirm:$false
$results | ConvertTo-Json -Depth 10
'''
```

### Etapa 5: Interface para Vincular Agent ao Tenant

**Modificar:** `TenantConnectionWizard.tsx`

Adicionar nova etapa opcional "Análise Avançada":

```typescript
// Novo step no wizard
const STEPS = [
  { key: 'client', label: 'Cliente', icon: Building },
  { key: 'tenant', label: 'Tenant', icon: Globe },
  { key: 'agent', label: 'Agent (Opcional)', icon: Server },  // NOVO
  { key: 'authorize', label: 'Autorizar', icon: Shield },
];

// Na etapa 'agent':
<div className="space-y-4">
  <Label>Vincular Agent para Análise Avançada</Label>
  <p className="text-sm text-muted-foreground">
    Para análises via PowerShell (Transport Rules, DLP, etc.), 
    selecione um Agent e faça upload do certificado no Azure.
  </p>
  
  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione um agent (opcional)" />
    </SelectTrigger>
    <SelectContent>
      {agents.filter(a => a.certificate_thumbprint).map(agent => (
        <SelectItem key={agent.id} value={agent.id}>
          {agent.name} ({agent.certificate_thumbprint.substring(0, 8)}...)
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  
  {selectedAgentId && (
    <Card className="bg-blue-500/5 border-blue-500/20">
      <CardContent className="py-4">
        <h4 className="font-medium mb-2">Instruções para Azure</h4>
        <ol className="text-sm text-muted-foreground space-y-2">
          <li>1. Baixe o certificado público do agent</li>
          <li>2. No Azure Portal, vá em App Registrations → iScope 360</li>
          <li>3. Em "Certificates & Secrets", clique em "Upload certificate"</li>
          <li>4. Faça upload do arquivo .crt</li>
        </ol>
        <Button variant="outline" className="mt-4" onClick={downloadCertificate}>
          <Download className="w-4 h-4 mr-2" />
          Baixar Certificado (.crt)
        </Button>
      </CardContent>
    </Card>
  )}
</div>
```

### Etapa 6: Atualização de Agents Existentes

**Opções:**

#### Opção A: Via Auto-Update (Transparente)
O próximo release do agent incluirá a lógica de geração de certificado no `main.py`:

```python
# Em main.py, antes do loop principal
def ensure_certificate():
    cert_dir = Path("/var/lib/iscope-agent/certs")
    cert_path = cert_dir / "m365.crt"
    
    if not cert_path.exists():
        cert_dir.mkdir(parents=True, exist_ok=True)
        
        # Gerar via subprocess (openssl)
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", str(cert_dir / "m365.key"),
            "-out", str(cert_path),
            "-sha256", "-days", "730", "-nodes",
            "-subj", f"/CN=iScope-Agent-{socket.gethostname()}/O=iScope 360"
        ], check=True)
        
        # Calcular e salvar thumbprint
        result = subprocess.run(
            ["openssl", "x509", "-in", str(cert_path), "-noout", "-fingerprint", "-sha1"],
            capture_output=True, text=True
        )
        thumbprint = result.stdout.split("=")[1].strip().replace(":", "")
        (cert_dir / "thumbprint.txt").write_text(thumbprint)
```

#### Opção B: Via Comando de Atualização
Adicionar flag `--upgrade` no instalador:

```bash
curl ... | sudo bash -s -- --upgrade
```

---

## Migração de Banco de Dados

```sql
-- 1. Adicionar campos ao agents
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS certificate_thumbprint TEXT,
ADD COLUMN IF NOT EXISTS certificate_public_key TEXT,
ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb;

-- 2. Criar tabela de vínculo tenant-agent
CREATE TABLE m365_tenant_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_record_id UUID NOT NULL REFERENCES m365_tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_record_id, agent_id)
);

-- 3. RLS
ALTER TABLE m365_tenant_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant agents"
ON m365_tenant_agents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM m365_tenants t
    JOIN clients c ON t.client_id = c.id
    WHERE t.id = tenant_record_id
    AND (c.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
);
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/agent-install/index.ts` | **Modificar** | Adicionar geração de certificado |
| `supabase/functions/register-agent/index.ts` | **Modificar** | Aceitar thumbprint |
| `python-agent/agent/auth.py` | **Modificar** | Enviar thumbprint no registro |
| `python-agent/agent/executors/powershell.py` | **Criar** | Executor PowerShell |
| `python-agent/main.py` | **Modificar** | ensure_certificate() |
| `python-agent/requirements.txt` | **Modificar** | (nenhuma dependência nova) |
| `src/components/m365/TenantConnectionWizard.tsx` | **Modificar** | Nova etapa de agent |
| `supabase/migrations/xxx_add_agent_certificate.sql` | **Criar** | Schema changes |

---

## Benefícios

| Aspecto | Impacto |
|---------|---------|
| **Transparência** | Certificado gerado automaticamente, usuário só precisa fazer upload no Azure |
| **Segurança** | Chave privada nunca sai do servidor do cliente |
| **Compatibilidade** | Agents existentes podem ser atualizados via auto-update |
| **Flexibilidade** | Conexão via PowerShell é opcional, Graph API continua funcionando |
| **Manutenção** | Certificado válido por 2 anos, renovação automática planejada |

---

## Seção Técnica

### Permissões Adicionais no Azure App

Para PowerShell, adicionar ao App Registration:
- `Exchange.ManageAsApp` (Application permission)

E no Exchange Admin Center:
1. New-ServicePrincipal com AppId
2. Add-RoleGroupMember "Security Reader" -Member <ServicePrincipalObjectId>

### Dependências no Agent

```bash
# Já instalado pelo script
python3, openssl

# Novo (para análises M365)
pwsh >= 7.2
ExchangeOnlineManagement >= 3.0.0
Microsoft.Graph >= 2.0.0
```

### Geração de Certificado (Detalhes)

```bash
openssl req -x509 \
  -newkey rsa:2048 \
  -keyout m365.key \
  -out m365.crt \
  -sha256 \
  -days 730 \
  -nodes \
  -subj "/CN=iScope-Agent-hostname/O=iScope 360"
```

- **rsa:2048**: Mínimo aceito pelo Azure AD
- **sha256**: Algoritmo de hash seguro
- **730 dias**: 2 anos de validade
- **-nodes**: Sem senha na chave (necessário para automação)

