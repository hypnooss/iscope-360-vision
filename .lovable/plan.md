

# Plano: Integrar Enumeração de Subdomínios (Amass) na Análise de Domínios Externos

## Visão Geral

Este plano adiciona a capacidade de **enumeração de subdomínios** usando OWASP Amass ao fluxo de análise de domínios externos. Os subdomínios descobertos serão exibidos no relatório de análise.

---

## Componentes Já Prontos

| Componente | Status |
|------------|--------|
| AmassExecutor no Python Agent | Implementado |
| Instalação do Amass nos Agents | Implementado |
| Blueprint de External Domain | Existe (apenas DNS) |
| Tabela `external_domain_analysis_history` | Existe |
| RPC `rpc_get_agent_tasks` | Funcional |

---

## Alterações Necessárias

### 1. Blueprint - Adicionar Step do Amass

**Arquivo:** Atualizar no banco via UI ou SQL

**Adicionar step ao blueprint "External Domain DNS Scan":**

```json
{
  "steps": [
    // ... steps existentes de DNS ...
    {
      "id": "subdomain_enum",
      "executor": "amass",
      "config": {
        "mode": "passive",
        "timeout": 300
      }
    }
  ]
}
```

O step será executado após os DNS queries e retornará:
- `domain`: domínio alvo
- `subdomains`: lista de subdomínios com fontes e IPs
- `total_found`: quantidade total
- `sources`: fontes de dados usadas

---

### 2. Agent Task Result - Processar Resultado do Amass

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

**Alterações:**
- Adicionar mapeamento de endpoint para `subdomain_enum`
- Extrair dados do Amass e incluir no `report_data`
- Criar resumo de subdomínios similar ao `dns_summary`

```typescript
// Em sourceKeyToEndpoint
'subdomain_enum': 'Amass (Subdomain Enumeration)',

// Nova interface
interface SubdomainSummary {
  total_found: number;
  subdomains: Array<{
    subdomain: string;
    sources: string[];
    addresses: Array<{ ip: string; type: string }>;
  }>;
  sources: string[];
  mode: string;
}

// No processamento do resultado
const subdomainData = getStepPayload(rawData, 'subdomain_enum');
if (subdomainData?.data) {
  subdomainSummary = {
    total_found: subdomainData.data.total_found || 0,
    subdomains: subdomainData.data.subdomains || [],
    sources: subdomainData.data.sources || [],
    mode: subdomainData.data.mode || 'passive',
  };
}
```

---

### 3. Frontend - Exibir Subdomínios no Relatório

**Arquivo:** `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

**Alterações:**
- Adicionar nova seção "Subdomínios Descobertos"
- Exibir lista de subdomínios com:
  - Nome do subdomínio
  - Endereços IP (se disponíveis)
  - Fontes de descoberta
- Adicionar contador no header do relatório

**Novo componente sugerido:** `SubdomainSection.tsx`

```tsx
interface SubdomainSectionProps {
  subdomains: Array<{
    subdomain: string;
    sources: string[];
    addresses: Array<{ ip: string }>;
  }>;
  totalFound: number;
  sources: string[];
}

function SubdomainSection({ subdomains, totalFound, sources }: SubdomainSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Subdomínios Descobertos ({totalFound})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Fontes: {sources.join(', ')}
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subdomínio</TableHead>
              <TableHead>Endereços IP</TableHead>
              <TableHead>Fontes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subdomains.map((sub, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono">{sub.subdomain}</TableCell>
                <TableCell>{sub.addresses.map(a => a.ip).join(', ') || '-'}</TableCell>
                <TableCell className="text-xs">{sub.sources.join(', ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

---

### 4. Types - Atualizar Interfaces

**Arquivo:** `src/types/compliance.ts`

```typescript
export interface SubdomainEntry {
  subdomain: string;
  sources: string[];
  addresses: Array<{ ip: string; type?: string }>;
}

export interface SubdomainSummary {
  total_found: number;
  subdomains: SubdomainEntry[];
  sources: string[];
  mode: 'passive' | 'active';
}

export interface ComplianceReport {
  // ... campos existentes ...
  subdomainSummary?: SubdomainSummary;
}
```

---

### 5. PDF - Incluir Subdomínios no Relatório PDF

**Arquivo:** `src/components/pdf/ExternalDomainPDF.tsx`

**Alterações:**
- Adicionar seção de subdomínios no PDF
- Listar até 50 subdomínios (para não sobrecarregar o PDF)
- Incluir contagem total e fontes

---

## Regras de Compliance (Opcional)

Podemos adicionar regras de compliance para subdomínios:

| Código | Nome | Lógica |
|--------|------|--------|
| SUB-001 | Subdomínios Encontrados | Informativo - lista subdomínios descobertos |
| SUB-002 | Subdomínios Expostos | Aviso se > 50 subdomínios públicos |

*Nota: Essas regras são opcionais e podem ser adicionadas posteriormente.*

---

## Sequência de Implementação

```text
1. Atualizar Blueprint
   └── Adicionar step "subdomain_enum" com config do Amass

2. Atualizar agent-task-result
   └── Processar resultado do Amass
   └── Incluir subdomain_summary no report_data

3. Atualizar Frontend
   └── Criar SubdomainSection.tsx
   └── Integrar no ExternalDomainAnalysisReportPage
   └── Atualizar types/compliance.ts

4. Atualizar PDF (opcional)
   └── Adicionar seção de subdomínios no PDF

5. Testar
   └── Executar análise em domínio de teste
   └── Verificar se subdomínios aparecem no relatório
```

---

## Considerações

1. **Timeout**: O Amass pode demorar até 5 minutos no modo passivo. O timeout atual do blueprint é adequado.

2. **Volume de dados**: Domínios grandes podem ter centenas de subdomínios. A UI deve implementar paginação ou mostrar apenas os primeiros N.

3. **Modo passivo vs ativo**: Inicialmente usaremos modo **passivo** (consulta APIs públicas). O modo ativo (brute-force DNS) pode ser habilitado futuramente via configuração.

4. **Cache**: Considerar cachear resultados do Amass por algumas horas para evitar consultas excessivas às APIs de terceiros.

