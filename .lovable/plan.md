

# Fix: Exibir dados de web_services na pagina Attack Surface Analyzer

## Problema

O scan completou com sucesso (score 76, 16 servicos, 13 IPs), porem a interface nao mostra nada porque:

1. **masscan nao esta instalado** no servidor, entao `ports` fica vazio
2. **nmap nao executou** (depende do masscan), entao `services` fica vazio
3. **httpx executou com sucesso** e encontrou web services (URLs, TLS, tecnologias), mas a UI ignora o campo `web_services`

Resultado: PortHeatmap retorna null, TechStackSection retorna null, e cada IP mostra "Nenhum dado disponivel".

## Solucao

Atualizar a pagina e os tipos para exibir os dados de `web_services` que o httpx coletou.

### 1. Tipo `AttackSurfaceIPResult` em `useAttackSurfaceData.ts`

Adicionar o campo `web_services` ao tipo:

```
export interface AttackSurfaceWebService {
  url: string;
  status_code: number;
  title: string;
  server: string;
  technologies: string[];
  content_length: number;
  tls: {
    cipher?: string;
    issuer?: string[];
    subject_cn?: string;
    version?: string;
    not_after?: string;
  };
}

export interface AttackSurfaceIPResult {
  ports: number[];
  services: AttackSurfaceService[];
  web_services?: AttackSurfaceWebService[];  // novo
  vulns: string[];
  os: string;
  hostnames: string[];
  error?: string;
}
```

### 2. Pagina `AttackSurfaceAnalyzerPage.tsx`

**TechStackSection** - Incluir tecnologias do httpx:
- Alem de `r.services`, iterar `r.web_services` para extrair `technologies[]` e `server`
- Exibir as tecnologias detectadas (HSTS, CloudFront, Amazon Web Services, etc.)

**IPDetailRow** - Exibir web services:
- Coluna "Servicos" deve contar `services.length + web_services.length`
- Na expansao do detalhe, adicionar secao "Web Services Detectados" mostrando:
  - URL
  - Status Code
  - Tecnologias
  - TLS (issuer, CN, cipher)
  - Server header
- Remover a mensagem "Nenhum dado disponivel" quando houver web_services

**PortHeatmap** - Quando nao ha portas mas ha web services:
- Extrair portas das URLs do httpx (porta 80 para http, 443 para https, ou porta customizada da URL)
- Exibir como "Portas Detectadas (Web)" mesmo sem masscan

### 3. Detalhe das alteracoes por componente

**TechStackSection:**
```
// Adicionar ao loop existente:
(r.web_services || []).forEach((ws) => {
  // Extrair technologies
  (ws.technologies || []).forEach(tech => {
    const existing = products.get(tech) || { count: 0, versions: new Set() };
    existing.count++;
    products.set(tech, existing);
  });
  // Extrair server header
  if (ws.server) {
    const existing = products.get(ws.server) || { count: 0, versions: new Set() };
    existing.count++;
    products.set(ws.server, existing);
  }
});
```

**IPDetailRow (contagem):**
```
// Servicos = nmap services + web services
const serviceCount = (result?.services?.length ?? 0) + (result?.web_services?.length ?? 0);
```

**IPDetailRow (expansao) - Nova secao Web Services:**
Tabela com colunas: URL, Status, Server, Tecnologias, TLS
Exibida quando `result?.web_services?.length > 0`

**IPDetailRow (mensagem vazia):**
Alterar condicao para: `services.length === 0 && web_services.length === 0 && !error`

### Arquivos alterados
- `src/hooks/useAttackSurfaceData.ts` - Novo tipo `AttackSurfaceWebService`, campo `web_services` em `AttackSurfaceIPResult`
- `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` - TechStackSection, IPDetailRow, PortHeatmap atualizados para usar web_services
