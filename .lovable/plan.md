

# Unificar servicos Nmap + httpx por porta

## Problema atual

O Nmap e o httpx analisam as mesmas portas (ex: 80, 443, 10443), mas os resultados aparecem em cards separados:
- `NmapServiceRow` mostra porta + produto/nome + scripts NSE
- `WebServiceRow` mostra URL + status code + tecnologias

O usuario quer ver um unico card por porta que combine ambas as informacoes.

## Solucao

Na secao "Servicos e Tecnologias" do `AssetCard`, em vez de renderizar os dois tipos separadamente, criar um passo de merge que agrupa por porta:

1. Para cada `webService`, extrair a porta da URL
2. Encontrar o `service` do Nmap com a mesma porta
3. Quando houver match, renderizar um card unificado com:
   - **Titulo**: URL completa do httpx (ex: `https://ida-fw.taschibra.com.br:443`)
   - **Badges**: status code do httpx + tecnologias
   - **Detalhes do Nmap**: produto, versao, extra_info, scripts NSE
   - **CVEs**: combinados de ambas as fontes
4. Servicos Nmap sem match httpx: renderizar como `NmapServiceRow` (como hoje)
5. Web services httpx sem match Nmap: renderizar como `WebServiceRow` (como hoje)

## Plano Tecnico

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

#### 1. Criar funcao utilitaria `extractPortFromUrl`

```typescript
function extractPortFromUrl(url: string): number | null {
  try {
    const u = new URL(url);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : null;
  } catch { return null; }
}
```

#### 2. Criar componente `UnifiedServiceRow`

Componente que renderiza um card combinado:
- Titulo: URL clicavel (do httpx)
- Status code badge (do httpx)
- Produto/versao/extra_info (do Nmap)
- Tecnologias (do httpx)
- Scripts NSE expandiveis (do Nmap)
- CVEs combinados

#### 3. Alterar a logica de renderizacao na secao "Servicos e Tecnologias" (linhas 891-907)

Em vez de iterar `services` e depois `webServices` separadamente:

```
1. Criar mapa port -> nmapService
2. Para cada webService:
   a. Extrair porta da URL
   b. Se existe nmapService na mesma porta -> renderizar UnifiedServiceRow
   c. Marcar a nmapService como "consumida"
   d. Senao -> renderizar WebServiceRow (como hoje)
3. Para cada nmapService nao consumida -> renderizar NmapServiceRow (como hoje)
```

## Resultado esperado

Antes:
```
80/    http    [NSE]
443/   https   [NSE]
10443/ cirrossp
https://ida-fw.taschibra.com.br:443   [403]
https://ida-fw.taschibra.com.br:10443 [200] HSTS
http://ida-fw.taschibra.com.br:80     [307] HSTS
```

Depois:
```
http://ida-fw.taschibra.com.br:80     [307] HSTS
  http | [NSE expandivel]

https://ida-fw.taschibra.com.br:443   [403]
  https | [NSE expandivel]

https://ida-fw.taschibra.com.br:10443 [200] HSTS
  cirrossp

(servicos nmap sem httpx continuam como antes)
```

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Adicionar `extractPortFromUrl`, criar `UnifiedServiceRow`, alterar logica de merge na secao de servicos |
