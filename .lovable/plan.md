

## Diagnóstico: Aba "Proteção" mostrando tudo zerado

### Causa raiz

Os snapshots existentes no banco de dados foram gerados **antes** da função `analyzeThreatProtection` ser adicionada ao backend. Olhando os dados reais do snapshot mais recente (`446dbf53...`), o campo `metrics` contém `phishing`, `exfiltration`, `securityRisk`, etc., mas **não contém `threatProtection`**. 

O hook `useM365AnalyzerData.ts` faz fallback para defaults zerados quando `m.threatProtection` é `undefined`, resultando em todos os KPIs em 0 e todas as políticas como "Desativado".

### Solução

A edge function `m365-analyzer` precisa ser **redeployada** para que a nova lógica `analyzeThreatProtection` seja executada. Após o deploy, a **próxima execução** do Analyzer gerará um snapshot com os dados de `threatProtection` populados.

### Ações necessárias

1. **Deploy da edge function `m365-analyzer`** — o código já está correto no repositório, mas precisa ser deployado no Supabase para que novas execuções incluam o módulo `analyzeThreatProtection`.

2. **Executar uma nova análise** — após o deploy, disparar uma nova análise do tenant para gerar um snapshot com os dados de proteção contra ameaças.

Nenhuma alteração de código é necessária. O problema é exclusivamente de deploy/timing.

