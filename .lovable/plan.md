

## Análise do Problema

Sim, faz total sentido! Aqui está o que está acontecendo:

- **Páginas de Compliance** (Domain Report, M365 Posture Report): usam `max-w-7xl mx-auto` — isso limita o conteúdo a ~80rem (1280px) e centraliza, criando bastante espaço lateral em telas grandes.
- **Demais páginas** (Analyzer, Entra ID, Firewall Analyzer, etc.): **não têm** nenhum `max-w`, então o conteúdo ocupa 100% da largura disponível, ficando com pouco respiro lateral.

### Solução: Padronização global no `AppLayout`

Em vez de ajustar página por página, a abordagem mais limpa é adicionar um padding lateral maior diretamente no `<main>` do `AppLayout.tsx` e **remover** o `max-w-7xl mx-auto` das páginas de compliance.

**Antes** (AppLayout, linha 853):
```
<main className="flex-1 flex flex-col min-h-screen cyber-grid">{children}</main>
```

**Depois**:
```
<main className="flex-1 flex flex-col min-h-screen cyber-grid px-2 lg:px-6">{children}</main>
```

Isso adiciona ~24px de respiro lateral em desktop para **todas** as páginas, sem limitar a largura máxima.

Combinado com o `p-6 lg:p-8` que cada página já aplica internamente, o resultado será ~56px total em desktop — um meio-termo entre o espaçamento atual das páginas normais (~32px) e o das páginas de compliance (~centenas de px em telas largas).

### Mudanças necessárias

1. **`src/components/layout/AppLayout.tsx`** (linha 853): Adicionar `px-2 lg:px-6` ao `<main>`
2. **`src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`**: Remover o wrapper `max-w-7xl mx-auto`
3. **`src/pages/m365/M365PostureReportPage.tsx`**: Remover o wrapper `max-w-7xl mx-auto`

Resultado: todas as páginas terão espaçamento lateral consistente e equilibrado.

