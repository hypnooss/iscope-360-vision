

## Aba lateral de detalhes nos Rankings de Proteção

### Objetivo

Ao clicar em um item dos rankings (domínio de SPAM, alvo de phishing, fonte de malware), abrir um Sheet lateral no mesmo padrão do ComplianceDetailSheet, exibindo informações detalhadas sobre aquele domínio/usuário.

### Dados disponíveis

Os rankings atuais contêm apenas `{ domain/user, count }`. Para enriquecer a aba lateral, o backend precisa incluir dados adicionais por entidade. Especificamente, do `exoMessageTrace` já coletado podemos extrair:

- **Para domínios de SPAM**: lista de subjects, recipients afetados, timestamps
- **Para alvos de phishing**: lista de senders, subjects, timestamps  
- **Para fontes de malware**: lista de recipients, subjects, timestamps

### Alterações

**1. Backend: `supabase/functions/m365-analyzer/index.ts`**

Enriquecer os rankings para incluir detalhes por entidade:

```ts
topSpamSenderDomains: { 
  domain: string; count: number; 
  recipients: string[];      // usuários afetados
  sampleSubjects: string[];  // últimos 5 subjects
}[]
topPhishingTargets: { 
  user: string; count: number; 
  senders: string[];          // domínios de origem
  sampleSubjects: string[];
}[]
topMalwareSenders: { 
  domain: string; count: number; 
  recipients: string[];
  sampleSubjects: string[];
}[]
```

Acumular esses arrays durante a iteração do `exoMessageTrace` (usando Sets para recipients/senders únicos, e limitando subjects a 10).

**2. Tipos: `src/types/m365AnalyzerInsights.ts`**

Atualizar a interface `M365AnalyzerMetrics.threatProtection` para refletir os novos campos nos rankings.

**3. Novo componente: `src/components/m365/analyzer/ThreatDetailSheet.tsx`**

Sheet lateral seguindo o padrão do `ComplianceDetailSheet`:
- **Header**: Ícone + nome do domínio/usuário + badge com contagem + badge do tipo (SPAM/Phishing/Malware)
- **Aba Análise**: Descrição contextual (ex: "Este domínio enviou 342 emails de SPAM"), impacto, recomendação
- **Aba Evidências**: Lista de recipients/senders afetados, sample subjects
- Cores por tipo: SPAM=laranja, Phishing=vermelho, Malware=roxo

**4. Componente: `src/components/m365/analyzer/ThreatProtectionTab.tsx`**

- Adicionar state para `selectedItem` e `sheetOpen`
- Tornar cada item do `RankingList` clicável (cursor pointer, hover effect)
- Passar callback `onItemClick` ao `RankingList`
- Renderizar `ThreatDetailSheet` com os dados do item selecionado

### Arquivos modificados

1. `supabase/functions/m365-analyzer/index.ts` — enriquecer rankings com detalhes
2. `src/types/m365AnalyzerInsights.ts` — tipos dos rankings
3. `src/components/m365/analyzer/ThreatDetailSheet.tsx` — novo componente (sheet lateral)
4. `src/components/m365/analyzer/ThreatProtectionTab.tsx` — tornar rankings clicáveis

