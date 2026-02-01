

## Plano: Lógica Condicional de Alta Disponibilidade (HA)

### Objetivo
Ajustar a lógica de avaliação da categoria "Alta Disponibilidade" para que os itens **Heartbeat HA Redundante (ha-003)** e **Sincronização de Sessões HA (ha-002)** sejam desativados quando o modo HA for "standalone", e melhorar a exibição das evidências para usuários leigos.

---

### Regras de Negócio

| Regra | Modo Standalone | Modo HA Ativo |
|-------|-----------------|---------------|
| **ha-001** (Modo HA) | Status: **fail** (standalone não é HA) | Status: **pass** |
| **ha-002** (Sincronização) | Status: **unknown** (N/A) | Avaliar session-pickup |
| **ha-003** (Heartbeat) | Status: **unknown** (N/A) | Avaliar quantidade de links |

---

### Alterações Técnicas

#### 1. Arquivo: `supabase/functions/agent-task-result/index.ts`

**1.1 Atualizar `formatHAEvidence` (ha-001)**
- Retornar objeto com `evidence` + `status` (ao invés de só array)
- Quando `mode === 'standalone'`: retornar `status: 'fail'`
- Quando `mode !== 'standalone'`: retornar `status: 'pass'` com info de grupo/prioridade

**1.2 Criar nova função `formatHASessionSyncEvidence` (ha-002)**
```text
┌─────────────────────────────────────────────────────────────┐
│ Se mode === 'standalone':                                   │
│   → Status: unknown                                         │
│   → Evidência: "N/A - HA não configurado"                   │
│   → skipRawData: true                                       │
├─────────────────────────────────────────────────────────────┤
│ Se mode !== 'standalone':                                   │
│   → Verificar campo "session-pickup"                        │
│   → Se "enable": Status pass                                │
│   → Se "disable": Status fail/warn                          │
│                                                             │
│ Evidências (formato amigável):                              │
│   - Status: ✅ Ativada / ❌ Desativada                       │
│   - Modo: Descrição humanizada do comportamento             │
│   - Tipos: Sessões regulares, NAT, Expectation, etc.        │
└─────────────────────────────────────────────────────────────┘
```

**1.3 Atualizar `formatHAHeartbeatEvidence` (ha-003)**
- Melhorar formato das evidências quando ativo:
```text
┌─────────────────────────────────────────────────────────────┐
│ Quando HA ativo e heartbeat configurado:                    │
│                                                             │
│ Evidências:                                                 │
│   - Status: "✅ X links de heartbeat configurados"          │
│   - Interface: Nome de cada interface (uma por linha)       │
│                                                             │
│ Exemplo:                                                    │
│   Status      | ✅ 2 links de heartbeat configurados        │
│   Interface   | port1                                       │
│   Interface   | port2                                       │
└─────────────────────────────────────────────────────────────┘
```

**1.4 Adicionar tratamento no loop principal**
- Adicionar bloco `else if (rule.code === 'ha-002')` para chamar `formatHASessionSyncEvidence`
- Definir `status` e `details` baseado no resultado

---

### Mapeamento de Campos do FortiGate

| Campo API | Significado | Exibição Amigável |
|-----------|-------------|-------------------|
| `session-pickup` | Sincronização de sessões principais | "Sincronização de Sessões" |
| `session-pickup-nat` | Sincronização de sessões NAT | "Sessões NAT" |
| `session-pickup-connectionless` | Sincronização UDP/ICMP | "Sessões sem Conexão (UDP/ICMP)" |
| `session-pickup-expectation` | Sincronização de expectativas FTP/SIP | "Expectativas de Protocolo" |
| `session-sync-dev` | Dispositivo/interface de sincronização | "Interface de Sincronização" |
| `hbdev` | Interfaces de heartbeat | "Interfaces de Heartbeat" |

---

### Exemplo de Evidências Humanizadas

**ha-002 (Sincronização de Sessões) - Quando Ativo:**
```
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status                  │ ✅ Sincronização ativa           │
│ Sessões TCP/UDP         │ Habilitado                       │
│ Sessões NAT             │ Desabilitado                     │
│ Sessões sem Conexão     │ Desabilitado                     │
│ Expectativas            │ Desabilitado                     │
└────────────────────────────────────────────────────────────┘
```

**ha-003 (Heartbeat) - Quando Ativo:**
```
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status                  │ ✅ 2 links de heartbeat          │
│ Interface               │ port1                            │
│ Interface               │ port2                            │
└────────────────────────────────────────────────────────────┘
```

---

### Resultado Esperado

1. **Modo Standalone**: 
   - ha-001: Falha (standalone = sem HA)
   - ha-002: Indisponível (ícone cinza)
   - ha-003: Indisponível (ícone cinza)
   - Categoria mostra apenas ha-001 como métrica

2. **Modo HA Ativo**:
   - ha-001: Pass (HA configurado)
   - ha-002: Avaliado normalmente
   - ha-003: Avaliado normalmente
   - Todas as regras contam para o percentual

