

## Implementar Sheet lateral (50vw) para categorias do Exchange Analyzer

### Problema
Os cards do "Panorama por Categoria" têm `cursor-pointer` e `onCategoryClick` prop, mas a page nunca passa o callback -- clicar não faz nada.

### Solução
Criar um novo componente `ExchangeCategorySheet` seguindo o padrão do Firewall `AnalyzerCategorySheet` (Sheet 50vw, abas inline, scroll area), e conectar o `onCategoryClick` na page.

### Dados disponíveis
O `exchange-dashboard` retorna apenas agregados numéricos (totais de sent/received, spam, phishing, malware, forwarding, etc.) -- não rankings detalhados como o Firewall. O `analyzerSnapshot` contém `metrics.threatProtection` com dados de ameaças. Portanto, cada categoria mostrará:

- **Tráfego de Email**: Abas "Enviados" / "Recebidos" com totais e proporção visual (barra)
- **Anti-Spam / Phishing / Malware**: Contagem de detecções, severity badge, dados de threatProtection do analyzer snapshot (rankings de domínios/usuários se disponíveis)
- **Forwarding / Auto-Reply / Inativas / Over Quota**: Contagem, percentual sobre total de mailboxes, barra de proporção, descrição do risco

### Alterações

**1. Novo componente `src/components/m365/exchange/ExchangeCategorySheet.tsx`**
- Sheet com `sm:max-w-[50vw]`, header com ícone e título da categoria
- Renderização condicional por categoria:
  - `email_traffic`: Abas inline "Enviados"/"Recebidos" com totais e barra proporcional
  - `anti_spam`/`phishing`/`malware`: Badge de severity, total, rankings de threatProtection do snapshot (topAttackerDomains, topTargetedUsers se existirem)
  - `forwarding`/`auto_reply`/`inactive_mailboxes`/`over_quota`: Card com total, percentual, barra de risco, descrição/recomendação
- Seguir estilo visual exato do Firewall: abas `rounded-none border-b-2`, ScrollArea, Cards internos

**2. Alterar `ExchangeAnalyzerCategoryGrid.tsx`**
- Exportar o tipo `ExchangeOperationalCategory`

**3. Alterar `ExchangeAnalyzerPage.tsx`**
- Importar `ExchangeCategorySheet` no lugar do `ExchangeAnalyzerCategorySheet` existente
- Adicionar state para categoria selecionada e passar `onCategoryClick` ao grid
- Passar `dashboardData` e `analyzerSnapshot` ao sheet

