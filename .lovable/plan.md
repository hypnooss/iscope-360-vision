

# Corrigir borda branca da tabela de Compliance

## Problema

A tabela de Compliance esta envolvida por um `<Card>` sem a classe `glass-card`. O componente Card aplica `border border-border` por padrao, que no tema escuro resulta em uma borda branca/clara com opacidade total.

Os stats cards na mesma pagina usam `glass-card`, que aplica `border border-border/50` (50% de opacidade), resultando em uma borda sutil e consistente com o design.

## Solucao

Adicionar a classe `glass-card` ao `<Card>` da tabela (linha 545 de `ExternalDomainReportsPage.tsx`), igualando ao padrao visual dos demais cards da pagina e das outras telas de Dominio Externo.

## Mudanca

### Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

**Linha 545**: Alterar `<Card>` para `<Card className="glass-card">`.

Isso aplica `bg-card/80 backdrop-blur-xl border border-border/50` ao card da tabela, tornando a borda sutil e consistente.

