

# Plano de Implementacao - Melhorias na Pagina de Analise de Compliance

## Resumo do Problema

Identificamos dois problemas na pagina de analise de compliance do FortiGate:

1. **Card de Vulnerabilidades (CVEs) ausente**: O componente `CVESection` nao esta sendo renderizado porque o campo `firmwareVersion` esta vazio/nulo nos dados de analise. O blueprint de coleta atualizado inclui o endpoint de status do sistema, mas a versao do firmware nao esta sendo extraida corretamente.

2. **Badge de severidade confusa**: Quando um check esta em conformidade (status: pass), o badge de severidade "CRITICAL" ainda aparece em vermelho vibrante, dando a impressao visual de que algo esta errado.

---

## Solucao Proposta

### 1. Corrigir Extracao de Firmware Version

**Problema**: O `agent-task-result` nao esta extraindo a versao do firmware dos dados coletados pelo agente.

**Solucao**: Atualizar a funcao de processamento no edge function `agent-task-result` para extrair a versao do firmware dos endpoints de status do sistema:

- Buscar em `raw_data.system_status.version`
- Buscar em `raw_data.system_firmware.current.version`
- Aplicar regex para normalizar o formato (ex: "v7.2.5" -> "7.2.5")

**Arquivos afetados**:
- `supabase/functions/agent-task-result/index.ts`

---

### 2. Cores Contextuais para Badge de Severidade

**Problema Atual**: O badge de severidade usa cores fixas:
- CRITICAL = vermelho
- HIGH = laranja/amarelo
- MEDIUM = azul
- LOW = cinza

**Solucao**: Modificar as cores do badge para considerar o status do check:
- Se `status === 'pass'`: usar cores neutras (cinza/verde suave) independente da severidade
- Se `status === 'fail'` ou `status === 'warning'`: manter as cores atuais

Esta abordagem:
- Mantem a informacao da severidade visivel
- Remove o alarme visual desnecessario em checks aprovados
- Melhora a experiencia do usuario ao interpretar rapidamente os resultados

**Arquivos afetados**:
- `src/components/ComplianceCard.tsx`

---

## Detalhes Tecnicos

### Modificacao 1: agent-task-result/index.ts

```typescript
// Adicionar funcao para extrair versao limpa
function extractVersion(versionString: string): string {
  if (!versionString) return "";
  const match = versionString.match(/(\d+\.\d+\.?\d*)/);
  return match ? match[1] : "";
}

// Na funcao de processamento, buscar versao em multiplas fontes:
const systemStatus = rawDataMap.get('system_status') || {};
const systemFirmware = rawDataMap.get('system_firmware') || {};

let firmwareVersion = extractVersion(
  systemStatus?.version || 
  systemFirmware?.current?.version ||
  systemInfo?.version || 
  ""
);
```

### Modificacao 2: ComplianceCard.tsx

```typescript
// Cores para checks que PASSARAM (neutras)
const severityColorsPass: Record<string, string> = {
  critical: 'bg-muted text-muted-foreground',
  high: 'bg-muted text-muted-foreground',
  medium: 'bg-muted text-muted-foreground',
  low: 'bg-muted text-muted-foreground',
};

// Cores para checks que FALHARAM ou tem WARNING (alarmantes)
const severityColorsFail: Record<string, string> = {
  critical: 'bg-destructive/20 text-destructive',
  high: 'bg-warning/20 text-warning',
  medium: 'bg-primary/20 text-primary',
  low: 'bg-muted text-muted-foreground',
};

// Uso no componente:
const severityClass = normalizedStatus === 'pass' 
  ? severityColorsPass[check.severity] 
  : severityColorsFail[check.severity];
```

---

## Impacto Visual Esperado

### Antes (Problema)
```
+------------------------------------------+
| [OK] RDP Exposto para Internet  CRITICAL |
|      (badge vermelho alarme)             |
+------------------------------------------+
```

### Depois (Solucao)
```
+------------------------------------------+
| [OK] RDP Exposto para Internet  CRITICAL |
|      (badge cinza neutro)                |
+------------------------------------------+
```

---

## Passos de Implementacao

1. **Atualizar edge function `agent-task-result`**:
   - Adicionar funcao `extractVersion()`
   - Modificar logica de extracao do firmware para buscar em multiplos campos
   - Garantir que `firmwareVersion` seja incluido no resultado

2. **Atualizar `ComplianceCard.tsx`**:
   - Criar mapeamento de cores contextual baseado no status
   - Aplicar classe CSS apropriada ao badge de severidade

3. **Testar**:
   - Executar nova analise para verificar se CVESection aparece
   - Verificar se checks aprovados exibem badges em cores neutras

