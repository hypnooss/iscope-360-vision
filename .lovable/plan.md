

# Plano: Gerenciamento de Updates de Agents via Interface

## Objetivo

Adicionar na página de **Administração > Configurações > Agents** uma seção para gerenciar as atualizações dos agents, permitindo:
- Definir versão disponível
- Fazer upload do pacote (.tar.gz)
- Gerenciar checksum automaticamente
- Controlar flag de update forçado
- Visualizar agents desatualizados

---

## Layout Proposto

A aba **Agents** terá dois Cards:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Configurações dos Agents                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Intervalo de Heartbeat: [__120__] segundos                           │  │
│  │  (configuração existente)                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Gerenciamento de Atualizações                             [v1.0.0] atual   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  NOVA VERSÃO                                                        │    │
│  │                                                                     │    │
│  │  Versão:    [______1.1.0______]                                     │    │
│  │  Pacote:    [Selecionar arquivo .tar.gz]  iscope-agent-1.1.0.tar.gz│    │
│  │  Checksum:  sha256:a1b2c3d4... (calculado automaticamente)          │    │
│  │                                                                     │    │
│  │  [x] Forçar atualização (ignorar tarefas pendentes)                 │    │
│  │                                                                     │    │
│  │  [Publicar Atualização]                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  STATUS DOS AGENTS                                                  │    │
│  │                                                                     │    │
│  │  ● 3 agents atualizados (v1.0.0)                                    │    │
│  │  ● 2 agents desatualizados                                          │    │
│  │    - Agent-01 (v0.9.0) - Cliente A                                  │    │
│  │    - Agent-02 (v0.8.5) - Cliente B                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Arquivo: `src/pages/admin/SettingsPage.tsx`

#### Novos States

```typescript
// Agent update management
const [agentLatestVersion, setAgentLatestVersion] = useState('');
const [agentUpdateChecksum, setAgentUpdateChecksum] = useState('');
const [agentForceUpdate, setAgentForceUpdate] = useState(false);
const [uploadingPackage, setUploadingPackage] = useState(false);
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [calculatedChecksum, setCalculatedChecksum] = useState('');
const [publishingUpdate, setPublishingUpdate] = useState(false);
const [agentStats, setAgentStats] = useState<{
  total: number;
  upToDate: number;
  outdated: { name: string; version: string; client: string }[];
}>({ total: 0, upToDate: 0, outdated: [] });
```

#### Novas Funções

1. **loadAgentUpdateSettings** - Carrega configurações atuais de update
2. **loadAgentStats** - Busca estatísticas de versões dos agents
3. **handleFileSelect** - Processa seleção do arquivo e calcula SHA256
4. **calculateSHA256** - Calcula checksum do arquivo no browser (usando Web Crypto API)
5. **handlePublishUpdate** - Faz upload para Storage e atualiza system_settings

#### Lógica de Upload

```typescript
const handlePublishUpdate = async () => {
  if (!selectedFile || !agentLatestVersion) {
    toast.error('Selecione um arquivo e informe a versão');
    return;
  }

  setPublishingUpdate(true);
  try {
    // 1. Upload para Supabase Storage
    const filename = `iscope-agent-${agentLatestVersion}.tar.gz`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('agent-releases')
      .upload(filename, selectedFile, {
        upsert: true,
        contentType: 'application/gzip'
      });

    if (uploadError) throw uploadError;

    // 2. Atualizar system_settings
    const updates = [
      { key: 'agent_latest_version', value: agentLatestVersion },
      { key: 'agent_update_checksum', value: calculatedChecksum },
      { key: 'agent_force_update', value: agentForceUpdate }
    ];

    for (const update of updates) {
      await supabase
        .from('system_settings')
        .update({ 
          value: update.value, 
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('key', update.key);
    }

    toast.success(`Versão ${agentLatestVersion} publicada com sucesso!`);
    await loadAgentUpdateSettings();
    setSelectedFile(null);
  } catch (error) {
    console.error('Error publishing update:', error);
    toast.error('Erro ao publicar atualização');
  } finally {
    setPublishingUpdate(false);
  }
};
```

#### Cálculo de Checksum no Browser

```typescript
const calculateSHA256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.name.endsWith('.tar.gz')) {
    toast.error('Selecione um arquivo .tar.gz');
    return;
  }

  setSelectedFile(file);
  setUploadingPackage(true);
  
  try {
    const checksum = await calculateSHA256(file);
    setCalculatedChecksum(checksum);
  } catch (error) {
    toast.error('Erro ao calcular checksum');
  } finally {
    setUploadingPackage(false);
  }
};
```

---

## Novo Card: Gerenciamento de Atualizações

```tsx
<Card className="border-border/50">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Gerenciamento de Atualizações
        </CardTitle>
        <CardDescription>
          Publique novas versões do agent para atualização automática
        </CardDescription>
      </div>
      {agentLatestVersion && (
        <Badge variant="outline" className="text-sm">
          Versão atual: v{agentLatestVersion}
        </Badge>
      )}
    </div>
  </CardHeader>
  <CardContent className="space-y-6">
    {/* Nova Versão */}
    <div className="space-y-4 p-4 border rounded-lg">
      <h4 className="font-medium">Publicar Nova Versão</h4>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Versão</Label>
          <Input
            placeholder="1.1.0"
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Pacote (.tar.gz)</Label>
          <Input
            type="file"
            accept=".tar.gz"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {calculatedChecksum && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-muted-foreground">SHA256:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {calculatedChecksum.substring(0, 32)}...
          </code>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch
          checked={agentForceUpdate}
          onCheckedChange={setAgentForceUpdate}
        />
        <Label>Forçar atualização (ignorar tarefas pendentes)</Label>
      </div>

      <Button 
        onClick={handlePublishUpdate} 
        disabled={!selectedFile || !newVersion || publishingUpdate}
      >
        {publishingUpdate ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-2" />
        )}
        Publicar Atualização
      </Button>
    </div>

    {/* Status dos Agents */}
    <div className="space-y-4">
      <h4 className="font-medium">Status dos Agents</h4>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <div>
            <p className="font-medium">{agentStats.upToDate} atualizados</p>
            <p className="text-xs text-muted-foreground">v{agentLatestVersion}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="font-medium">{agentStats.outdated.length} desatualizados</p>
            <p className="text-xs text-muted-foreground">Aguardando update</p>
          </div>
        </div>
      </div>

      {agentStats.outdated.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Agents desatualizados:</p>
          <ul className="space-y-1">
            {agentStats.outdated.map((agent, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{agent.name}</span>
                <Badge variant="outline" className="text-xs">v{agent.version}</Badge>
                <span className="text-muted-foreground">- {agent.client}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </CardContent>
</Card>
```

---

## Resumo de Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/admin/SettingsPage.tsx` | Editar | Adicionar seção de gerenciamento de updates |

---

## Novos Imports Necessários

```typescript
import { Upload, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
```

---

## Fluxo do Usuário

1. Admin acessa **Configurações > Agents**
2. Na seção "Gerenciamento de Atualizações":
   - Informa a versão (ex: `1.1.0`)
   - Seleciona o arquivo `.tar.gz` do pacote
   - Sistema calcula automaticamente o SHA256
   - Opcionalmente marca "Forçar atualização"
3. Clica em **Publicar Atualização**
4. Sistema:
   - Faz upload para bucket `agent-releases`
   - Atualiza `system_settings` com versão, checksum e flag
5. Agents detectam update no próximo heartbeat e atualizam automaticamente
6. Seção "Status dos Agents" mostra progresso da atualização

---

## Segurança

- Apenas Super Admins têm acesso à página
- Upload vai para bucket público `agent-releases` (necessário para agents baixarem)
- Checksum garante integridade do pacote
- Agents verificam checksum antes de aplicar update

