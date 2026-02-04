

## Reformulação do Relatório PDF de Domínio Externo

### Objetivo

Transformar o PDF atual de "checklist técnico" em um **guia prático de correção** para administradores de infraestrutura não especialistas em segurança.

---

### Visão Geral das Mudanças

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         ANTES (Checklist Técnico)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Página 1: Score 86, porcentagens, tabela resumo                        │
│  Página 2: Lista de falhas (técnica)                                    │
│  Página 3: Mapa DNS                                                     │
│  Página 4+: Detalhamento por categoria (pass/fail com %)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      DEPOIS (Guia Prático de Correção)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Página 1: Como Ler Este Relatório + Postura Geral (Boa/Atenção/Crítica)│
│  Página 2: Resumo Executivo Visual (Prioridades, não porcentagens)      │
│  Página 3: Mapa DNS (mantido)                                           │
│  Página 4+: Cartões Explicativos (O que é, Por que importa, Como corrigir)│
│  Página Final: Plano de Ação Sugerido (Roadmap temporal)                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Alterações Detalhadas

#### 1. Nova Seção: "Como Ler Este Relatório" (Página 1)

**Novo componente:** `PDFHowToRead.tsx`

Conteúdo:
- "Este relatório avalia apenas a configuração pública do domínio (DNS e email)."
- "Cada item informa o risco, o impacto prático e como corrigir."
- Legenda de prioridades com ícones visuais:
  - Vermelho: Corrigir agora - risco real de fraude ou indisponibilidade
  - Laranja: Planejar correção - melhora resiliência
  - Verde: OK - nenhuma ação necessária

---

#### 2. Substituir Score Numérico por Classificação Compreensível

**Arquivo:** `PDFScoreGauge.tsx` e `ExternalDomainPDF.tsx`

| Antes | Depois |
|-------|--------|
| Score: 86 | Postura Geral: Boa |
| 86% | Ícone visual + texto descritivo |
| Taxa de aprovação | Contagem por prioridade |

**Nova lógica:**
- Score >= 75: "Postura Geral: Boa" (verde)
- Score >= 50: "Postura Geral: Atenção" (laranja)
- Score < 50: "Postura Geral: Crítica" (vermelho)

**Novo texto resumo:**
"Postura geral: Boa, com 1 risco crítico e 2 melhorias recomendadas"

**Remover:**
- Número de score (86)
- Porcentagens nas categorias
- Gauge circular numérico

**Adicionar:**
- Contagem de problemas por prioridade (Corrigir agora: X, Planejar: Y, OK: Z)

---

#### 3. Transformar Falhas em "Cartões Explicativos"

**Novo componente:** `PDFExplanatoryCard.tsx`

Estrutura de cada cartão:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [●] DMARC não configurado                              🔴 CRÍTICO  │
├─────────────────────────────────────────────────────────────────────┤
│ O QUE É                                                             │
│ Sistema que protege seu domínio contra envio de emails falsos       │
├─────────────────────────────────────────────────────────────────────┤
│ POR QUE IMPORTA                                                     │
│ Sem DMARC, qualquer pessoa pode enviar emails fingindo ser você     │
├─────────────────────────────────────────────────────────────────────┤
│ IMPACTO POSSÍVEL                                                    │
│ • Clientes recebem emails falsos em seu nome                        │
│ • Perda de confiança e danos à reputação                            │
│ • Emails legítimos podem ir para spam                               │
├─────────────────────────────────────────────────────────────────────┤
│ COMO CORRIGIR                                                       │
│ 1. Acesse seu painel DNS (Cloudflare, Registro.br, etc.)            │
│ 2. Adicione um registro TXT para _dmarc.seudominio.com              │
│ 3. Valor inicial: v=DMARC1; p=none; rua=mailto:admin@seudominio.com │
│ 4. Após 30 dias, mude p=none para p=quarantine                      │
├─────────────────────────────────────────────────────────────────────┤
│ ⏱ Dificuldade: Baixa    |    ⏰ Tempo estimado: 15 min              │
└─────────────────────────────────────────────────────────────────────┘
```

**Campos do cartão:**

| Campo | Descrição |
|-------|-----------|
| Título | Nome amigável (sem jargões) |
| Prioridade | Ícone colorido + texto (Crítico/Recomendado/OK) |
| O que é | Descrição em 1 frase simples |
| Por que importa | Explicação do risco em linguagem leiga |
| Impacto possível | Lista de consequências práticas |
| Como corrigir | Passo a passo direto com exemplos de provedores |
| Dificuldade | Baixa/Média/Alta |
| Tempo estimado | 5 min/15 min/30 min/1h |

---

#### 4. Simplificar Linguagem Técnica

**Arquivo:** Criar mapeamento de termos em `pdfStyles.ts` ou novo arquivo `pdfTranslations.ts`

| Termo Técnico | Tradução Simples |
|---------------|------------------|
| Delegation Signer (DS) | Assinatura de segurança do DNS |
| DNSKEY | Chave de autenticação do domínio |
| Cadeia de confiança | Sistema de verificação em camadas |
| Lookups SPF | Consultas de verificação |
| Record TXT | Configuração de texto no DNS |
| MX Records | Servidores que recebem seus emails |
| Nameservers | Servidores que controlam seu domínio |
| DNSSEC | Proteção contra falsificação de DNS |

---

#### 5. Melhorar Recomendações

**Regra de linguagem:**

| Evitar | Usar |
|--------|------|
| "Considere habilitar" | "Ative" |
| "Recomenda-se" | "Faça" |
| "É aconselhável" | "Adicione" |
| "Pode ser interessante" | "Configure" |

**Estrutura obrigatória:**
1. **Onde configurar:** Nome do painel/sistema
2. **Passos:** Numerados, objetivos
3. **Exemplos:** Cloudflare, Registro.br, GoDaddy, Microsoft 365

---

#### 6. Nova Seção Final: "Plano de Ação Sugerido"

**Novo componente:** `PDFActionPlan.tsx`

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      PLANO DE AÇÃO SUGERIDO                         │
├─────────────────────────────────────────────────────────────────────┤
│ 🔴 IMEDIATO (0-7 dias)                                              │
│ ├── Configurar DMARC básico (15 min)                                │
│ └── Corrigir registro SPF (10 min)                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 🟠 CURTO PRAZO (30 dias)                                            │
│ ├── Habilitar DNSSEC (30 min)                                       │
│ └── Adicionar segundo servidor de email (1h)                        │
├─────────────────────────────────────────────────────────────────────┤
│ 🟢 MELHORIA CONTÍNUA                                                │
│ ├── Revisar política DMARC para reject                              │
│ └── Monitorar relatórios de email mensalmente                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Componentes a Criar

| Componente | Arquivo | Propósito |
|------------|---------|-----------|
| PDFHowToRead | `src/components/pdf/sections/PDFHowToRead.tsx` | Seção "Como ler este relatório" |
| PDFPostureOverview | `src/components/pdf/sections/PDFPostureOverview.tsx` | Substituir Score Gauge por visão geral |
| PDFExplanatoryCard | `src/components/pdf/sections/PDFExplanatoryCard.tsx` | Cartão explicativo para cada falha |
| PDFActionPlan | `src/components/pdf/sections/PDFActionPlan.tsx` | Plano de ação temporal |

---

### Componentes a Modificar

| Componente | Arquivo | Alteração |
|------------|---------|-----------|
| PDFScoreGauge | `src/components/pdf/sections/PDFScoreGauge.tsx` | Remover número, mostrar classificação textual |
| PDFCategorySection | `src/components/pdf/sections/PDFCategorySection.tsx` | Remover porcentagens, usar cartões explicativos |
| PDFCategorySummaryTable | `src/components/pdf/sections/PDFCategorySummaryTable.tsx` | Simplificar para contagem por prioridade |
| PDFIssuesSummary | `src/components/pdf/sections/PDFIssuesSummary.tsx` | Converter para cartões explicativos |
| ExternalDomainPDF | `src/components/pdf/ExternalDomainPDF.tsx` | Reorganizar páginas e integrar novos componentes |

---

### Estrutura Final do PDF

| Página | Conteúdo |
|--------|----------|
| 1 | Header + "Como Ler Este Relatório" + Postura Geral + Resumo de Prioridades |
| 2 | Mapa DNS (mantido, já acessível) |
| 3+ | Cartões Explicativos por Categoria (apenas falhas com detalhamento completo) |
| Final | Plano de Ação Sugerido |

---

### Dados Necessários para Cartões Explicativos

Cada regra de compliance precisará de campos adicionais (ou mapeamento):

```typescript
interface ExplanatoryContent {
  friendlyTitle: string;        // Título amigável
  whatIs: string;               // O que é (1 frase)
  whyMatters: string;           // Por que importa
  impacts: string[];            // Impactos possíveis (lista)
  howToFix: string[];           // Passos de correção
  difficulty: 'low' | 'medium' | 'high';
  timeEstimate: string;         // "15 min", "1h"
  providerExamples?: string[];  // Cloudflare, Registro.br
}
```

**Implementação:** Criar arquivo `src/components/pdf/data/explanatoryContent.ts` com mapeamento por rule ID (ex: SPF-001, DKIM-001, DMARC-001, DNS-001, etc.)

---

### Exemplo de Mapeamento (explanatoryContent.ts)

```typescript
export const EXPLANATORY_CONTENT: Record<string, ExplanatoryContent> = {
  'DMARC-001': {
    friendlyTitle: 'Proteção contra emails falsos (DMARC)',
    whatIs: 'Sistema que protege seu domínio contra envio de emails falsos por terceiros.',
    whyMatters: 'Sem DMARC, qualquer pessoa pode enviar emails fingindo ser sua empresa.',
    impacts: [
      'Clientes podem receber emails fraudulentos em seu nome',
      'Perda de confiança e danos à reputação',
      'Emails legítimos podem ir para a pasta de spam',
    ],
    howToFix: [
      'Acesse o painel DNS do seu domínio (Cloudflare, Registro.br, GoDaddy)',
      'Adicione um novo registro do tipo TXT',
      'Nome: _dmarc.seudominio.com',
      'Valor: v=DMARC1; p=none; rua=mailto:admin@seudominio.com',
      'Após 30 dias monitorando, mude p=none para p=quarantine',
    ],
    difficulty: 'low',
    timeEstimate: '15 min',
    providerExamples: ['Cloudflare', 'Registro.br', 'GoDaddy', 'Microsoft 365'],
  },
  // ... demais regras
};
```

---

### Considerações de Implementação

1. **Manter layout visual:** Cores, fontes e estrutura geral serão preservadas
2. **Escopo restrito:** Apenas DNS e autenticação de email (sem portas, TLS, vulnerabilidades web)
3. **Compatibilidade @react-pdf/renderer:** Todos os novos componentes seguirão as restrições conhecidas (sem `gap`, sem Unicode especial)
4. **Fallback para regras sem mapeamento:** Usar descrição/recomendação existente formatada de forma simplificada

