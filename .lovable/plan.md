
# Plano: Substituir Data de Análise por Uptime do Firewall

## Resumo
Remover o campo "Análise: 24/01/2026" do card de informações do firewall (já exibido no cabeçalho) e substituí-lo pelo **uptime do dispositivo**, que já é coletado durante a análise.

---

## Alterações Necessárias

### 1. Backend: Incluir Uptime no system_info

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

O uptime está disponível no `system_status.results` retornado pela API do FortiGate. Precisamos extraí-lo e incluí-lo no `system_info`:

```typescript
// Linha ~253-259: Adicionar extração do uptime
if (systemStatus?.results) {
  const results = systemStatus.results as Record<string, unknown>;
  systemInfo.hostname = results.hostname;
  systemInfo.version = results.version;
  systemInfo.serial = results.serial;
  systemInfo.model = results.model;
  
  // Calcular uptime formatado
  if (typeof results.uptime === 'number') {
    const uptimeSec = results.uptime;
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    systemInfo.uptime = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
  }
}
```

---

### 2. Tipo: Adicionar uptime ao systemInfo

**Arquivo:** `src/types/compliance.ts`

Adicionar campo `uptime` ao tipo `systemInfo`:

```typescript
systemInfo?: {
  hostname?: string;
  model?: string;
  serial?: string;
  uptime?: string;  // ← Adicionar
};
```

---

### 3. Frontend: Extrair uptime na normalização

**Arquivo:** `src/pages/FirewallAnalysis.tsx`

Atualizar a extração do `systemInfo` para incluir `uptime`:

```typescript
const systemInfo = rawSystemInfo ? {
  hostname: rawSystemInfo.hostname as string | undefined,
  model: rawSystemInfo.model as string | undefined,
  serial: rawSystemInfo.serial as string | undefined,
  uptime: rawSystemInfo.uptime as string | undefined,  // ← Adicionar
} : undefined;
```

---

### 4. Dashboard: Substituir Análise por Uptime

**Arquivo:** `src/components/Dashboard.tsx`

Remover o campo "Análise" (linhas 113-121) e substituir por "Uptime":

```tsx
// Antes (remover)
<div className="flex items-center gap-2">
  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
  <span className="text-muted-foreground text-sm">Análise:</span>
  <span className="font-medium text-foreground text-sm">
    {report.generatedAt instanceof Date 
      ? report.generatedAt.toLocaleDateString('pt-BR')
      : new Date(report.generatedAt).toLocaleDateString('pt-BR')}
  </span>
</div>

// Depois
<div className="flex items-center gap-2">
  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
  <span className="text-muted-foreground text-sm">Uptime:</span>
  <span className="font-medium text-foreground text-sm">
    {report.systemInfo?.uptime || 'N/A'}
  </span>
</div>
```

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Extrair e formatar uptime do system_status |
| `src/types/compliance.ts` | Adicionar campo `uptime` ao tipo systemInfo |
| `src/pages/FirewallAnalysis.tsx` | Extrair uptime na normalização dos dados |
| `src/components/Dashboard.tsx` | Substituir "Análise" por "Uptime" |

---

## Observação sobre Dados Existentes

Para análises já salvas no histórico, o uptime pode não estar disponível (retornará "N/A"). Apenas novas análises terão essa informação. Se necessário, podemos também atualizar a função `fortigate-compliance` para garantir compatibilidade com o fluxo legado.
