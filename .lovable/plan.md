
# Remover cards de resumo (Score + Stats)

## O que sera removido

O bloco inteiro da linha 777-803 que contem:
- Card "Score de Exposicao" com o gauge de 87 e timestamp
- 4 stat cards (IPs Publicos, Portas Abertas, Servicos, CVEs)

## O que sera mantido

Tudo acima (header, workspace selector, scan buttons, progress bar) e tudo abaixo (CVE Alert Banner, Port Heatmap, Tech Stack, Web Services, TLS Certificates, IP Inventory).

## Limpeza adicional

- Remover `statCards` useMemo/const (linhas 705-709) que alimentava os cards
- Remover o componente `ExposureScoreGauge` (linhas 117-170) se nao for usado em outro lugar
- Remover imports nao utilizados (`Clock`, `formatDistanceToNow`, `ptBR` se nao usados em outro lugar do arquivo)
