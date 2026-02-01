
## Plano: Corrigir Badge de Severidade Cinza para Status Unknown e Exibir Dados Brutos

### Resumo dos Problemas

| # | Item | Problema | Localização |
|---|------|----------|-------------|
| 1 | **2FA (sec-002)** | Badge de severidade com cor ativa em vez de cinza quando status = `unknown` | Frontend |
| 2 | **Criptografia Forte (sec-001)** | "Ver dados brutos (JSON)" não aparece quando status = `pass` | Backend |
| 3 | **Timeout de Sessão (sec-003)** | "Ver dados brutos (JSON)" não aparece | Backend |

---

### Problema 1: Badge com cor ativa para status `unknown`

**Análise Técnica:**
- O tipo `ComplianceStatus` em `src/types/compliance.ts` não inclui `unknown` (apenas `pass`, `fail`, `warning`, `pending`)
- O backend envia `status: 'unknown'`, mas o frontend não reconhece esse status
- A lógica de cor da badge verifica apenas `normalizedStatus === 'pass'`:

```tsx
normalizedStatus === 'pass' 
  ? severityColorsPass[check.severity]  // cores neutras (cinza)
  : severityColorsFail[check.severity]  // cores alarmantes (vermelho, laranja, etc.)
```

Como `unknown` não é `pass`, usa as cores de falha.

**Solução:**
1. Adicionar `unknown` ao tipo `ComplianceStatus`
2. Adicionar `unknown` ao `statusConfig` com ícone e estilo neutro
3. Atualizar a lógica da badge para incluir `unknown` junto com `pass` nas cores neutras

---

### Problemas 2 e 3: Dados brutos não exibidos

**Análise Técnica:**
No `agent-task-result/index.ts`, as funções `formatSecurityPolicyEvidence` retornam `skipRawData: true` para todos os cenários de sucesso:

```typescript
// sec-001 (Criptografia Forte) - linha 1199
if (strongCrypto === 'enable') {
  return { ..., skipRawData: true };  // ← nunca inclui rawData quando passa
}

// sec-003 (Timeout) - linha 1263  
return { ..., skipRawData: true };  // ← sempre suprime rawData
```

**Solução:**
Alterar `skipRawData: true` para `skipRawData: false` em todos os casos das regras `sec-001`, `sec-002` e `sec-003`, para que os dados brutos sejam sempre incluídos e disponíveis para Super Admins visualizarem.

---

### Alterações Necessárias

#### 1. Frontend: `src/types/compliance.ts`

**Adicionar `unknown` ao tipo:**
```typescript
export type ComplianceStatus = 'pass' | 'fail' | 'warning' | 'pending' | 'unknown';
```

#### 2. Frontend: `src/components/ComplianceCard.tsx`

**Adicionar configuração para status `unknown`:**
```typescript
const statusConfig: Record<ComplianceStatus, { icon: typeof CheckCircle; className: string; label: string }> = {
  pass: { icon: CheckCircle, className: 'status-pass', label: 'Aprovado' },
  fail: { icon: XCircle, className: 'status-fail', label: 'Falha' },
  warning: { icon: AlertTriangle, className: 'status-warning', label: 'Atenção' },
  pending: { icon: AlertTriangle, className: 'text-muted-foreground bg-muted/50 border-muted', label: 'Pendente' },
  unknown: { icon: AlertTriangle, className: 'text-muted-foreground bg-muted/50 border-muted', label: 'Indisponível' },
};
```

**Atualizar lógica da badge de severidade (linha 112-117):**
```typescript
<span className={cn(
  "text-xs px-2 py-0.5 rounded-full font-medium", 
  (normalizedStatus === 'pass' || normalizedStatus === 'unknown' || normalizedStatus === 'pending')
    ? (severityColorsPass[check.severity] || 'bg-muted text-muted-foreground')
    : (severityColorsFail[check.severity] || 'bg-muted text-muted-foreground')
)}>
```

#### 3. Backend: `supabase/functions/agent-task-result/index.ts`

**sec-001 (Criptografia Forte) - linhas 1196-1206:**
```typescript
if (strongCrypto === 'enable') {
  return {
    evidence: [{ label: 'Criptografia Forte', value: 'Habilitada', type: 'text' }],
    status: 'pass',
    skipRawData: false  // ← Alterado de true
  };
} else {
  return {
    evidence: [{ label: 'Criptografia Forte', value: 'Desabilitada', type: 'text' }],
    status: 'fail',
    skipRawData: false
  };
}
```

**sec-002 (2FA) - linhas 1216-1245:**
```typescript
// Quando dados não disponíveis
return {
  evidence: [...],
  status: 'unknown',
  skipRawData: false  // ← Alterado de true (não tem dados mesmo, mas mantém consistência)
};

// Quando todos com 2FA
return {
  evidence: [{ label: 'Status', value: 'Todos os administradores com 2FA', type: 'text' }],
  status: 'pass',
  skipRawData: false  // ← Alterado de true
};
```

**sec-003 (Timeout) - linhas 1257-1264:**
```typescript
return {
  evidence: [
    { label: 'Timeout de Sessão', value: `${timeout} minutos`, type: 'text' },
    { label: 'Status', value: isCompliant ? 'Configuração adequada' : 'Timeout muito longo (recomendado ≤30min)', type: 'text' }
  ],
  status: isCompliant ? 'pass' : 'warn',
  skipRawData: false  // ← Alterado de true
};
```

---

### Resultado Esperado

| Item | Antes | Depois |
|------|-------|--------|
| **2FA (unknown)** | Badge laranja "Alto" | Badge cinza "Alto" + label "Indisponível" |
| **Criptografia Forte** | Sem "Ver dados brutos (JSON)" | Exibe link para Super Admin |
| **Timeout de Sessão** | Sem "Ver dados brutos (JSON)" | Exibe link para Super Admin |

---

### Observação Importante

As alterações no **frontend** (badge cinza) serão aplicadas **imediatamente** a todos os relatórios existentes, pois é uma transformação visual.

As alterações no **backend** (exibir dados brutos) só aparecerão em **novas análises**, pois os dados são gerados durante a execução e salvos no `report_data`.
