

## Reformulação do Fluxo de Análise: Regras como Base

### Entendimento do Problema

Atualmente o "Fluxo de Análise" mostra:
```
Step (ns_records) → Regras vinculadas (DNS-003, DNS-004)
```

Mas você quer espelhar o relatório de compliance que o cliente vê:
```
Regra (DNS-004 - Diversidade de Nameservers) 
  → Steps que a alimentam (ns_records)
  → Análise efetuada (lógica de avaliação)
  → Parses usados (traduções de campos)
```

---

### Nova Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLUXO DE ANÁLISE                                                           │
│  Visualização baseada nas regras de compliance (como aparece no relatório)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ SEGURANÇA DNS ──────────────────────────────────────────────────────────┐
│  │                                                                          │
│  │  ┌─ DNS-001 • DNSSEC Habilitado ──────────────────────── [Alto] ────────┐│
│  │  │                                                                       ││
│  │  │  📝 Descrição da Regra                                               ││
│  │  │  Verifica se o DNSSEC está habilitado através da presença do DNSKEY. ││
│  │  │                                                                       ││
│  │  │  ⚙️ Análise Efetuada                                                 ││
│  │  │  data.has_dnskey = true                                              ││
│  │  │                                                                       ││
│  │  │  📡 Steps de Coleta                                                   ││
│  │  │  └── dnssec_status (DNS Query • Consulta DNSKEY)                     ││
│  │  │                                                                       ││
│  │  │  🔄 Parses (Traduções)                                               ││
│  │  │  └── data.has_dnskey → "Status DNSSEC"                               ││
│  │  │      true → "DNSSEC Ativado"                                         ││
│  │  │      false → "DNSSEC Desativado"                                     ││
│  │  │                                                                       ││
│  │  └───────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  │  ┌─ DNS-004 • Diversidade de Nameservers ────────────── [Médio] ────────┐│
│  │  │                                                                       ││
│  │  │  📝 Descrição da Regra                                               ││
│  │  │  Verifica se existem pelo menos 3 nameservers configurados.          ││
│  │  │                                                                       ││
│  │  │  ⚙️ Análise Efetuada                                                 ││
│  │  │  data.records.length >= 3                                            ││
│  │  │                                                                       ││
│  │  │  📡 Steps de Coleta                                                   ││
│  │  │  └── ns_records (DNS Query • Consulta NS)                            ││
│  │  │                                                                       ││
│  │  │  🔄 Parses (Traduções)                                               ││
│  │  │  └── data.records[].host → "Nameserver"                              ││
│  │  │                                                                       ││
│  │  └───────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ INFRAESTRUTURA DE EMAIL ────────────────────────────────────────────────┐
│  │                                                                          │
│  │  ┌─ MX-001 • Registro MX Configurado ───────────────── [Crítico] ───────┐│
│  │  │  ...                                                                  ││
│  │  └───────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Lógica de Organização

1. **Agrupar regras por categoria** (igual ao relatório)
   - Segurança DNS
   - Infraestrutura de Email
   - Autenticação de Email - SPF
   - Autenticação de Email - DKIM
   - Autenticação de Email - DMARC

2. **Para cada regra, mostrar:**
   - Código + Nome + Severidade (como no relatório)
   - Descrição da regra
   - Análise efetuada (derivada de `evaluation_logic`)
   - Steps de coleta que alimentam (via `evaluation_logic.step_id`)
   - Parses vinculados (futuramente do banco, hoje do hardcode)

---

### Modificações Necessárias

**Arquivo:** `src/components/admin/BlueprintFlowVisualization.tsx`

#### Mudanças Principais:

1. **Inverter a estrutura de dados:**
   ```typescript
   // ANTES: agrupar regras por step
   const rulesByStep = { ns_records: [DNS-003, DNS-004], ... }
   
   // DEPOIS: agrupar regras por categoria
   const rulesByCategory = { 
     "Segurança DNS": [DNS-001, DNS-002, DNS-003, DNS-004, DNS-005, DNS-006],
     "Infraestrutura de Email": [MX-001, MX-002, ...],
     ...
   }
   ```

2. **Criar componente `RuleFlowCard`:**
   - Mostra uma regra individual com todas as informações
   - Busca o step vinculado pelo `evaluation_logic.step_id`
   - Lista os parses associados (por enquanto do hardcode, depois do banco)

3. **Criar componente `CategoryFlowSection`:**
   - Agrupa regras por categoria
   - Colapsável com contagem de regras
   - Cores por categoria (igual ao relatório)

4. **Mapear parses relevantes por step_id:**
   ```typescript
   // Mapear campos que cada step pode gerar
   const STEP_FIELDS: Record<string, string[]> = {
     'dnssec_status': ['data.has_dnskey', 'data.has_ds', 'data.validated'],
     'ns_records': ['data.records', 'data.records[].host'],
     'soa_record': ['data.mname', 'data.contact_email', 'data.refresh', ...],
     'mx_records': ['data.records', 'data.records[].exchange', 'data.records[].priority'],
     'spf_record': ['data.raw', 'data.parsed.all', 'data.parsed.includes'],
     'dkim_records': ['data.found', 'data.found[].selector', 'data.found[].key_size_bits'],
     'dmarc_record': ['data.raw', 'data.parsed.p', 'data.parsed.rua', ...],
   };
   ```

5. **Utilizar os parses do `EvidenceDisplay.tsx`:**
   - Por enquanto, reutilizar as constantes `LABEL_TRANSLATIONS` e `VALUE_TRANSFORMATIONS`
   - Futuramente, buscar da tabela `evidence_parses`

---

### Cores por Categoria (Consistência com Relatório)

| Categoria | Cor | CSS Class |
|-----------|-----|-----------|
| Segurança DNS | Cyan | `border-cyan-500 bg-cyan-500/10` |
| Infraestrutura de Email | Violet | `border-violet-500 bg-violet-500/10` |
| Autenticação de Email - SPF | Emerald | `border-emerald-500 bg-emerald-500/10` |
| Autenticação de Email - DKIM | Pink | `border-pink-500 bg-pink-500/10` |
| Autenticação de Email - DMARC | Amber | `border-amber-500 bg-amber-500/10` |

---

### Integração com Parses (Próximo Passo)

A tabela `evidence_parses` já foi criada mas está vazia. Após essa implementação:

1. **Popular a tabela** com os dados de `EvidenceDisplay.tsx`
2. **Criar vinculo `step_id`** na tabela de parses
3. **Buscar dinamicamente** os parses vinculados a cada step/regra

---

### Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `src/components/admin/BlueprintFlowVisualization.tsx` | Reescrever: organizar por regras/categorias em vez de steps |

### Benefícios

1. **Espelha o relatório** - Mesma organização que o cliente vê
2. **Visão completa por regra** - Steps, análise e parses em um só lugar
3. **Facilita auditoria** - Admin entende exatamente como cada regra funciona
4. **Preparado para parses dinâmicos** - Quando populados no banco, já estarão visíveis
