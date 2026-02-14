

# Integrar Vulnerabilidades ao bloco de Servicos e Tecnologias

## Resumo

Eliminar o bloco separado "Vulnerabilidades" e exibir as CVEs diretamente dentro de cada linha de servico no bloco "Servicos e Tecnologias". Cada servico se torna condensavel/expansivel: no estado condensado mostra as 2 CVEs de maior score; no expandido mostra todas.

## Como funciona a correlacao

Cada CVE possui um campo `products: string[]`. Cada servico tem `product` (Nmap) ou `technologies`/`server` (web). A funcao `matchCVEsToIP` ja faz esse match por produto. Vamos reutilizar essa logica para distribuir CVEs por servico.

## Mudancas

### 1. Funcao auxiliar: distribuir CVEs por servico

Criar `matchCVEsToService(serviceName: string, cves: AttackSurfaceCVE[]): AttackSurfaceCVE[]` que filtra as CVEs cujo `products` ou `title` contenham o nome do servico. CVEs que nao correspondem a nenhum servico especifico serao agrupadas num bloco "Outras vulnerabilidades" no final da secao.

### 2. Cada linha de servico vira condensavel/expansivel

- Estado condensado (padrao): linha atual do servico + as 2 CVEs com maior `score`, exibidas como badges inline (ex: `CVE-2024-1234 (9.8)`)
- Estado expandido (clique): lista completa de CVEs daquele servico no mesmo formato de lista atual (link, severity badge, score, titulo)
- Um pequeno icone ChevronRight/ChevronDown no inicio da linha indica o estado

### 3. Bloco "Vulnerabilidades" removido

O bloco 4 (linhas 657-690) sera eliminado. Todo o conteudo de CVEs passa a viver dentro do bloco 2 ("Servicos e Tecnologias").

### 4. CVEs orfas

CVEs que nao correspondem a nenhum servico especifico serao listadas num sub-bloco "Outras Vulnerabilidades" ao final da secao de servicos, usando o mesmo layout expandivel.

### Layout visual esperado

```text
Servicos e Tecnologias
  [443/tcp]  nginx  1.18.0  "banner..."   [CVE-2024-1234 (9.8)] [CVE-2024-5678 (8.1)]  >
     (expandido)
     CVE-2024-1234  Critical  (9.8)  "NGINX HTTP/3 QUIC..."     [link]
     CVE-2024-5678  High      (8.1)  "NGINX mp4 module..."      [link]
     CVE-2024-9999  Medium    (6.5)  "NGINX resolver..."        [link]

  [80/tcp]   Apache  2.4.41                [CVE-2023-1111 (7.5)]                         >

  https://example.com  [200]  • nginx    PHP  WordPress  HSTS
     (sem CVEs associadas -- nenhum indicador extra)

  Outras Vulnerabilidades (2)
     CVE-2024-0000  High  (7.0)  "Generic vuln..."   [link]
     CVE-2024-0001  Low   (3.2)  "Info leak..."      [link]
```

## Detalhes tecnicos

Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**Nova funcao** `matchCVEsToService`:
- Recebe o nome do produto/servico e a lista de CVEs do asset
- Filtra por `cve.products.some(p => p.toLowerCase().includes(name))` ou `cve.title.toLowerCase().includes(name)`
- Retorna array ordenado por score decrescente

**Componente `ServiceRow`** (novo):
- Props: servico (Nmap ou Web), CVEs correspondentes
- Estado local `expanded: boolean` (default false)
- Condensado: linha atual + ate 2 CVE badges (maior score)
- Expandido: lista completa de CVEs abaixo da linha

**Bloco 2 atualizado**:
- Itera servicos Nmap e Web como hoje
- Para cada um, renderiza `<ServiceRow>` em vez do `<div>` atual
- Ao final, se houver CVEs orfas, renderiza bloco "Outras Vulnerabilidades" expansivel

**Bloco 4 removido**: linhas 657-690 eliminadas por completo

**Bloco "Portas Abertas"**: permanece inalterado (bloco 1)

**Bloco "Certificados TLS"**: permanece inalterado (bloco 3)
