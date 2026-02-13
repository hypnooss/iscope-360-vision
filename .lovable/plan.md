

# Restaurar secao "Web Services" no painel expandido do IP

## O que sera feito

Restaurar a secao "Web Services" no painel expandido da tabela de Inventario de IPs Publicos, exatamente como estava antes da remocao. Esta secao exibe URLs descobertas, status HTTP, servidor, tecnologias detectadas e informacoes de TLS.

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Inserir o bloco de Web Services entre a secao de Hostnames (linha 851) e a secao de CVEs (linha 853), dentro do painel expandido do `IPDetailRow`.

O bloco renderiza:
- URL com link externo e badge de status HTTP (colorido por faixa: verde 2xx, amarelo 3xx, vermelho 4xx/5xx)
- Servidor (ex: `nginx/1.28.0`)
- Tecnologias como badges coloridos por categoria (HSTS, Nextcloud, Nginx, PHP:8.3.27)
- Informacao de TLS: Common Name do certificado e dias ate expiracao

A coloracao das tecnologias reutilizara a funcao `getTechBadgeColor` ja existente no arquivo. O calculo de dias para expiracao do certificado TLS usara `tls.not_after` comparado com a data atual.

