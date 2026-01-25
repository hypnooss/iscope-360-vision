
# Plano: Restaurar Formatação de Evidencias do Compliance

## Problema
A funcao `processComplianceRules()` no `agent-task-result/index.ts` usa logica generica que converte valores complexos em JSON bruto:

```typescript
// Linha 288-297 - Logica atual (problematica)
evidence.push({
  label: logic.field_path || rule.name,
  value: isComplex ? JSON.stringify(value, null, 2) : String(value),
  type: isComplex ? 'code' : 'text'
});
```

Enquanto o `fortigate-compliance/index.ts` tinha formatadores especializados que geravam evidencias legiveis como:
- Status: Ativo
- Data de Expiracao: 05/04/2026  
- Dias Restantes: 75

---

## Solucao

Portar os formatadores especializados do `fortigate-compliance/index.ts` para o `agent-task-result/index.ts`.

### Arquivo: `supabase/functions/agent-task-result/index.ts`

#### 1. Adicionar formatadores especializados (apos linha 228)

**`formatFortiCareEvidence(rawData)`** - Regra lic-001
- Extrai status de suporte (licensed/registered)
- Calcula data de expiracao em formato DD/MM/YYYY
- Calcula dias restantes
- Gera evidencias: Status, Data de Expiracao, Dias Restantes

**`formatFortiGuardEvidence(rawData)`** - Regra lic-002
- Itera pelos servicos: antivirus, ips, web_filtering, appctrl, antispam
- Para cada servico: verifica status, expiry, dias restantes
- Gera evidencias: NomeServico -> "Ativo ate DD/MM/YYYY" ou "Expirado/Inativo"

**`formatVPNEncryptionEvidence(rawData)`** - Regras vpn-*
- Lista VPNs com proposals de criptografia
- Formata: "VPN: nome -> proposal: aes256-sha256"

**`formatLoggingEvidence(rawData)`** - Regras log-*
- Mostra status de FortiAnalyzer e FortiCloud
- Formata: "FortiAnalyzer -> Habilitado (servidor)" ou "Nao configurado"

**`formatHAEvidence(rawData)`** - Regra ha-001
- Mostra modo HA, grupo, prioridade
- Formata: "Modo: active-passive", "Grupo: HA-Cluster"

**`formatBackupEvidence(rawData)`** - Regra backup-001
- Mostra status e frequencia do backup automatico
- Formata: "Status: Ativo", "Frequencia: daily at 02:00"

**`formatGenericEvidence(value, fieldPath)`** - Fallback
- Trunca JSON > 500 caracteres com "... (truncado)"
- Evita poluicao visual

#### 2. Modificar geracao de evidencias (linhas 288-297)

```typescript
// Nova logica com deteccao de regras especificas
const evidence: EvidenceItem[] = [];
if (value !== undefined && value !== null) {
  // Detectar regra e aplicar formatador apropriado
  if (rule.code === 'lic-001') {
    evidence.push(...formatFortiCareEvidence(rawData));
  } else if (rule.code === 'lic-002') {
    evidence.push(...formatFortiGuardEvidence(rawData));
  } else if (rule.code.startsWith('vpn-')) {
    evidence.push(...formatVPNEvidence(rawData, rule.code));
  } else if (rule.code.startsWith('log-')) {
    evidence.push(...formatLoggingEvidence(rawData, rule.code));
  } else if (rule.code === 'ha-001') {
    evidence.push(...formatHAEvidence(rawData));
  } else if (rule.code === 'backup-001') {
    evidence.push(...formatBackupEvidence(rawData));
  } else {
    // Fallback generico com truncamento
    evidence.push(...formatGenericEvidence(value, logic.field_path || rule.name));
  }
}
```

---

## Resultado Esperado

### Licenciamento - FortiCare (lic-001)
| Campo | Valor |
|-------|-------|
| Status | Ativo |
| Data de Expiracao | 05/04/2026 |
| Dias Restantes | 75 |

### Licenciamento - FortiGuard (lic-002)
| Servico | Status |
|---------|--------|
| Antivirus | Ativo ate 19/04/2026 |
| IPS | Ativo ate 19/04/2026 |
| Web Filter | Ativo ate 19/04/2026 |
| App Control | Ativo ate 19/04/2026 |
| AntiSpam | Ativo ate 19/04/2026 |

### VPN
| VPN | Proposal |
|-----|----------|
| VPN-SEDE | aes256-sha256 |
| VPN-FILIAL | aes256-sha512 |

### Logging
| Sistema | Status |
|---------|--------|
| FortiAnalyzer | 192.168.1.100 |
| FortiCloud | Nao configurado |

---

## Impacto

| Item | Status |
|------|--------|
| Edge Function | `agent-task-result` modificada |
| Database | Sem alteracoes |
| Frontend | Sem alteracoes (ja renderiza corretamente) |
| Deploy | Automatico |
| Relatorios existentes | Nao afetados |

---

## Validacao

1. Executar nova analise do SAO-FW via trigger
2. Abrir pagina de Analise de Compliance
3. Verificar secao Licenciamento: FortiCare e FortiGuard com dados formatados
4. Verificar secao VPN: proposals de criptografia formatados
5. Verificar secao Logging: status de FortiAnalyzer/FortiCloud formatados
6. Verificar outras secoes: dados truncados se muito grandes
