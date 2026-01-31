
# Plano: Evidências Específicas por Card (MX, DKIM, DMARC)

## Problema Identificado

O backend usa `formatExternalDomainEvidence()` que gera as **mesmas evidências** para todos os checks que usam o mesmo step_id:

| Check | step_id | Problema |
|-------|---------|----------|
| MX-001 (Registro MX Configurado) | mx_records | Mostra IPs resolvidos (não deveria) |
| MX-002 (Redundância MX) | mx_records | Deveria mostrar IPs resolvidos |
| MX-003 (Prioridades MX) | mx_records | Mostra IPs resolvidos (não deveria) |
| DKIM-001 (DKIM Configurado) | dkim_records | Mostra JSON completo (deveria mostrar só quantidade) |
| DKIM-003 (Redundância DKIM) | dkim_records | Mostra JSON completo (deveria mostrar só nomes) |
| DMARC-003 (Relatórios RUA) | dmarc_record | Mostra p, sp, pct (deveria mostrar só rua) |
| DMARC-005 (Alinhamento SPF) | dmarc_record | Mostra tudo (deveria mostrar só aspf) |
| DMARC-006 (Alinhamento DKIM) | dmarc_record | Mostra tudo (deveria mostrar só adkim) |

## Solução

Criar evidências específicas **por `rule.code`** no backend, usando a mesma lógica que já existe para regras como `lic-001`, `utm-*`, etc.

---

## Alterações no Backend

### Arquivo: `supabase/functions/agent-task-result/index.ts`

Adicionar tratamento específico por rule.code após a linha ~2128 (onde estão os outros formatadores), antes do fallback genérico:

```typescript
// ========== EVIDÊNCIAS ESPECÍFICAS POR REGRA ==========

// MX-001: Registro MX Configurado (só exchange)
else if (rule.code === 'MX-001') {
  const mxData = sourceData as Record<string, unknown>;
  const records = mxData?.data?.records as Array<Record<string, unknown>> || [];
  if (records.length > 0) {
    const exchanges = records.map(r => String(r.exchange)).filter(Boolean);
    evidence = [{ 
      label: 'Servidores MX', 
      value: exchanges.join(', '), 
      type: 'text' 
    }];
  }
}

// MX-002: Redundância MX (exchange + IPs resolvidos + quantidade)
else if (rule.code === 'MX-002') {
  const mxData = sourceData as Record<string, unknown>;
  const records = mxData?.data?.records as Array<Record<string, unknown>> || [];
  if (records.length > 0) {
    // Manter formato JSON para frontend renderizar com todos os campos
    evidence = [{ label: 'data.records', value: JSON.stringify(records), type: 'code' }];
  }
}

// MX-003: Prioridades MX (só exchange e priority)
else if (rule.code === 'MX-003') {
  const mxData = sourceData as Record<string, unknown>;
  const records = mxData?.data?.records as Array<Record<string, unknown>> || [];
  if (records.length > 0) {
    const simplified = records.map(r => ({ exchange: r.exchange, priority: r.priority }));
    evidence = [{ label: 'data.records.simplified', value: JSON.stringify(simplified), type: 'code' }];
  }
}

// DKIM-001: DKIM Configurado (só quantidade de chaves)
else if (rule.code === 'DKIM-001') {
  const dkimData = sourceData as Record<string, unknown>;
  const found = dkimData?.data?.found as Array<Record<string, unknown>> || [];
  evidence = [{ 
    label: 'Chaves DKIM Encontradas', 
    value: found.length > 0 ? `${found.length} chave(s) configurada(s)` : 'Nenhuma chave DKIM encontrada', 
    type: 'text' 
  }];
}

// DKIM-002: Tamanho da Chave DKIM (mostrar seletor + tamanho)
else if (rule.code === 'DKIM-002') {
  const dkimData = sourceData as Record<string, unknown>;
  const found = dkimData?.data?.found as Array<Record<string, unknown>> || [];
  if (found.length > 0) {
    const keyInfo = found.map(k => `${k.selector || k.name}: ${k.key_size_bits || '?'} bits`).join(', ');
    evidence = [{ label: 'Tamanho das Chaves', value: keyInfo, type: 'text' }];
  }
}

// DKIM-003: Redundância DKIM (só nomes das chaves)
else if (rule.code === 'DKIM-003') {
  const dkimData = sourceData as Record<string, unknown>;
  const found = dkimData?.data?.found as Array<Record<string, unknown>> || [];
  if (found.length > 0) {
    const keyNames = found.map(k => String(k.selector || k.name)).filter(Boolean);
    evidence = [{ label: 'Seletores DKIM', value: keyNames.join(', '), type: 'text' }];
  } else {
    evidence = [{ label: 'Seletores DKIM', value: 'Nenhum seletor encontrado', type: 'text' }];
  }
}

// DMARC-003: Relatórios RUA (só rua)
else if (rule.code === 'DMARC-003') {
  const dmarcData = sourceData as Record<string, unknown>;
  const parsed = (dmarcData?.data?.parsed || {}) as Record<string, unknown>;
  const rua = parsed.rua;
  evidence = [{ 
    label: 'Relatórios (RUA)', 
    value: rua ? String(rua) : 'Não configurado', 
    type: 'text' 
  }];
}

// DMARC-005: Alinhamento SPF Estrito (só aspf)
else if (rule.code === 'DMARC-005') {
  const dmarcData = sourceData as Record<string, unknown>;
  const parsed = (dmarcData?.data?.parsed || {}) as Record<string, unknown>;
  const aspf = parsed.aspf;
  evidence = [{ 
    label: 'data.parsed.aspf', 
    value: aspf ? String(aspf) : 'Não configurado (padrão: relaxado)', 
    type: 'text' 
  }];
}

// DMARC-006: Alinhamento DKIM Estrito (só adkim)
else if (rule.code === 'DMARC-006') {
  const dmarcData = sourceData as Record<string, unknown>;
  const parsed = (dmarcData?.data?.parsed || {}) as Record<string, unknown>;
  const adkim = parsed.adkim;
  evidence = [{ 
    label: 'data.parsed.adkim', 
    value: adkim ? String(adkim) : 'Não configurado (padrão: relaxado)', 
    type: 'text' 
  }];
}
```

---

## Alterações no Frontend

### Arquivo: `src/components/compliance/EvidenceDisplay.tsx`

#### 1. Adicionar tratamento para MX simplificado (MX-003)

Detectar `data.records.simplified` e renderizar apenas exchange + priority:

```typescript
// Tratamento MX simplificado (sem IPs)
const isMxSimplifiedByLabel = item.label === 'data.records.simplified';

if (isMxSimplifiedByLabel && Array.isArray(parsed)) {
  const records = parsed as Array<Record<string, unknown>>;
  return (
    <div className="bg-muted/30 rounded-md p-3 border border-border/30 space-y-3">
      {records.map((rec, idx) => (
        <div key={idx} className="border-l-2 border-primary/30 pl-3 space-y-1">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Servidor MX</span>
            <span className="text-sm text-foreground font-mono">{String(rec.exchange)}</span>
          </div>
          {rec.priority !== undefined && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Prioridade</span>
              <span className="text-sm text-foreground font-mono">{String(rec.priority)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### 2. Adicionar tradução para novos labels

```typescript
const LABEL_TRANSLATIONS: Record<string, string> = {
  // ... existing translations ...
  'Servidores MX': 'Servidores MX',
  'Chaves DKIM Encontradas': 'Chaves DKIM Encontradas',
  'Seletores DKIM': 'Seletores DKIM',
  'Tamanho das Chaves': 'Tamanho das Chaves',
};
```

---

## Resultado Visual Esperado

### MX-001: Registro MX Configurado
```
EVIDÊNCIAS COLETADAS

│ Servidores MX
│ precisio-io.mail.protection.outlook.com
```

### MX-002: Redundância MX
```
EVIDÊNCIAS COLETADAS

│ Servidor MX
│ precisio-io.mail.protection.outlook.com

│ Prioridade
│ 0

│ IPs Resolvidos
│ 52.101.11.17, 52.101.42.13, ...

│ Quantidade de IPs
│ 8
```

### MX-003: Prioridades MX Configuradas
```
EVIDÊNCIAS COLETADAS

│ Servidor MX
│ precisio-io.mail.protection.outlook.com

│ Prioridade
│ 0
```

### DKIM-001: DKIM Configurado
```
EVIDÊNCIAS COLETADAS

│ Chaves DKIM Encontradas
│ 2 chave(s) configurada(s)
```

### DKIM-003: Redundância DKIM
```
EVIDÊNCIAS COLETADAS

│ Seletores DKIM
│ selector1._domainkey.precisio.io, selector2._domainkey.precisio.io
```

### DMARC-003: Relatórios RUA
```
EVIDÊNCIAS COLETADAS

│ Relatórios (RUA)
│ mailto:db93c273a8@rua.easydmarc.com
```

### DMARC-005: Alinhamento SPF Estrito
```
EVIDÊNCIAS COLETADAS

│ Alinhamento SPF
│ Relaxado (r)
```

### DMARC-006: Alinhamento DKIM Estrito
```
EVIDÊNCIAS COLETADAS

│ Alinhamento DKIM
│ Estrito (s) ✓
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Adicionar tratamento específico por rule.code para MX, DKIM e DMARC |
| `src/components/compliance/EvidenceDisplay.tsx` | Adicionar tratamento para `data.records.simplified` |

---

## Considerações Técnicas

1. **Separação de responsabilidades**: Backend gera evidências específicas por regra, frontend só renderiza
2. **Retrocompatibilidade**: MX-002 continua usando `data.records` com todos os campos
3. **Nova análise**: Após deploy, uma nova análise de domínio é necessária para gerar as evidências corretas
4. **Labels existentes**: Aproveitamos as traduções e transformações já definidas no frontend
