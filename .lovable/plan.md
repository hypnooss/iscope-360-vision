

# Redesign: Inventario de IPs Publicos - Visualizacao mais compreensivel

## Objetivo

Reformular a tabela de Inventario de IPs Publicos e seu painel de detalhes expandido para apresentar informacoes tecnicas de forma mais clara e acessivel.

## Mudancas propostas

### 1. Coluna "Servicos" na tabela principal - Mostrar produto + versao

Atualmente a coluna mostra apenas nomes crus (ex: `nginx`, `nginx/1.28.0`). Sera reformulada para exibir badges com produto e versao lado a lado:

- `nginx 1.28.0` (badge com versao visivel)
- `nginx` sem versao = badge com indicador "?" ou texto mutado "sem versao"
- `PHP 8.3.27` (extraido das tecnologias httpx)

### 2. Painel expandido - Secao "Servicos Descobertos" reformulada

Substituir a tabela tecnica atual (Porta/Protocolo/Produto/Versao/CPE) por um layout em cards agrupados por servico:

```text
+--------------------------------------------------+
| Porta 80/tcp                                     |
|   Produto: nginx                                 |
|   Versao: 1.28.0                                 |
|   CPE: cpe:/a:igor_sysoev:nginx:1.28.0          |
+--------------------------------------------------+
| Porta 443/tcp                                    |
|   Produto: nginx                                 |
|   Versao: nao detectada                          |
|   CPE: cpe:/a:igor_sysoev:nginx                  |
+--------------------------------------------------+
```

### 3. Painel expandido - Nova secao "Tecnologias Web"

Quando houver `web_services`, exibir as tecnologias detectadas por URL de forma visual:

```text
Web Services
  https://drive.taschibra.com.br (200 OK)
    Servidor: nginx/1.28.0
    Tecnologias: PHP:8.3.27, HSTS
    TLS: *.taschibra.com.br (expira em 120 dias)
```

### 4. Painel expandido - Secao "CVEs Vinculadas" com mais contexto

Adicionar o titulo da CVE e o produto afetado ao lado do badge de severidade, em formato de lista ao inves de badges inline:

```text
CVEs Vinculadas (5)
  CRITICAL  CVE-2024-3566  (9.8)  PHP - Argument Injection
  HIGH      CVE-2025-14177 (7.5)  nginx - HTTP/2 vulnerability
  ...
```

Cada item sera clicavel para abrir o advisory no NVD.

### 5. Coluna "Servicos" na tabela principal - Versao visivel

Reformular para mostrar `produto/versao` ao inves de so `produto`:

| Antes | Depois |
|---|---|
| `nginx` `nginx/1.28.0` | `nginx 1.28.0` `nginx` (sem versao) |

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

#### IPDetailRow - Coluna Servicos (linhas ~799-813)

Refatorar a logica de extracao de nomes de servicos para incluir versao:

```typescript
// Extrair produto+versao unicos para exibicao
const serviceDisplay = useMemo(() => {
  const items: { name: string; version: string | null }[] = [];
  const seen = new Set<string>();
  
  for (const svc of result?.services || []) {
    if (!svc.product) continue;
    const key = `${svc.product}:${svc.version || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name: svc.product, version: svc.version || null });
  }
  
  for (const ws of result?.web_services || []) {
    for (const tech of ws.technologies || []) {
      const [name, ver] = tech.split(':');
      const key = `${name}:${ver || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ name: name.trim(), version: ver?.trim() || null });
    }
  }
  
  return items;
}, [result]);
```

Renderizar como badges com versao visivel:

```typescript
{serviceDisplay.map((svc) => (
  <Badge key={`${svc.name}:${svc.version}`} variant="outline" className={getTechBadgeColor(svc.name)}>
    {svc.name}
    {svc.version ? (
      <span className="ml-1 text-primary font-mono">{svc.version}</span>
    ) : (
      <span className="ml-1 text-muted-foreground/50">?</span>
    )}
  </Badge>
))}
```

#### Painel expandido - Servicos (linhas ~850-879)

Substituir a tabela por cards inline:

```typescript
{result?.services?.length > 0 && (
  <div>
    <h4 className="text-sm font-medium mb-2">Servicos Descobertos</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {result.services.map((svc, i) => (
        <div key={i} className="rounded-lg border border-border/50 p-3 bg-background/50">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono">{svc.port}/{svc.transport}</Badge>
            <span className="font-medium text-sm">{svc.product || 'Desconhecido'}</span>
            {svc.version && <Badge variant="secondary" className="text-xs">{svc.version}</Badge>}
            {!svc.version && svc.product && (
              <span className="text-xs text-muted-foreground italic">versao nao detectada</span>
            )}
          </div>
          {svc.cpe?.length > 0 && (
            <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
              {svc.cpe[0]}
            </p>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

#### Painel expandido - Web Services (novo bloco)

Adicionar secao de web services dentro do painel expandido do IP:

```typescript
{result?.web_services?.length > 0 && (
  <div>
    <h4 className="text-sm font-medium mb-2">Web Services</h4>
    <div className="space-y-2">
      {result.web_services.map((ws, i) => (
        <div key={i} className="rounded-lg border border-border/50 p-3 bg-background/50">
          <div className="flex items-center gap-2 mb-1.5">
            <a href={ws.url} target="_blank" className="text-info hover:underline text-sm font-mono">
              {ws.url}
            </a>
            <Badge variant="outline" className={statusColorClass}>
              {ws.status_code}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {ws.server && <span>Servidor: <strong>{ws.server}</strong></span>}
            {ws.technologies?.length > 0 && (
              <span>Tecnologias: {ws.technologies.map(t => <Badge .../>)}</span>
            )}
            {ws.tls?.subject_cn && <span>TLS: {ws.tls.subject_cn}</span>}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

#### Painel expandido - CVEs (linhas ~882-900)

Reformular de badges inline para lista com titulo:

```typescript
{ipCVEs.length > 0 && (
  <div>
    <h4 className="text-sm font-medium mb-2">CVEs Vinculadas ({ipCVEs.length})</h4>
    <div className="rounded-lg border border-border/50 overflow-hidden">
      {ipCVEs
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map((cve) => (
        <div key={cve.cve_id} className="flex items-center gap-3 px-3 py-2 border-b last:border-0">
          <SeverityBadge severity={cve.severity} />
          <a href={advisory_url} className="font-mono text-sm hover:text-info">
            {cve.cve_id}
          </a>
          {cve.score && <span className="text-xs font-mono text-muted-foreground">({cve.score})</span>}
          <span className="text-xs text-muted-foreground truncate flex-1">{cve.title}</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      ))}
    </div>
  </div>
)}
```

### Resultado visual esperado

**Tabela principal**: Coluna Servicos mostra `nginx 1.28.0` e `PHP 8.3.27` com versao visivel. Coluna CVEs mostra contagem com badge colorido.

**Painel expandido**: 3 secoes visuais claras:
1. Servicos Descobertos - Cards com porta, produto, versao e CPE
2. Web Services - URLs com status, servidor, tecnologias e TLS
3. CVEs Vinculadas - Lista ordenada por severidade com titulo descritivo

### Arquivo modificado

- `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (componente `IPDetailRow`)

