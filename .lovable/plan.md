

# Extrair produto/fabricante dos dados httpx para tech badges

## Contexto

O scan do IP 201.28.184.186 (acessovpn.expansioneroma.com.br) coletou via httpx na porta 40443:
- **title**: "FortiGate"
- **subject_cn**: "FortiGate"
- **issuer**: "Fortinet Ltd."

Porem o bloco de construcao do `techSet` (linhas 411-451) so extrai `server` e `technologies[]` dos web_services httpx. Os campos `title` e `tls` sao completamente ignorados, mesmo contendo informacoes ricas sobre o produto.

## Solucao

Expandir a extracao de tecnologias do httpx (linhas 416-419) para incluir:

1. **title** -- se o titulo da pagina nao for generico (ex: nao for o proprio dominio), adicionar como tech. Isso captura "FortiGate", "pfSense", "MikroTik", etc.
2. **tls.subject_cn** -- se o CN do certificado nao for o hostname/dominio (ex: "FortiGate" vs "acessovpn.expansioneroma.com.br"), adicionar como tech de produto.

**Nao** adicionaremos o `tls.issuer` como tech separada, pois o `subject_cn` ja identifica o produto de forma mais precisa ("FortiGate" e mais util que "Fortinet Ltd.").

## Mudanca

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (linhas 416-419)

Adicionar apos o loop existente de `technologies`:

```text
for (const ws of result.web_services || []) {
  if (ws.server) techSet.add(ws.server);
  for (const t of ws.technologies || []) techSet.add(t);

  // [NOVO] Extrair produto do titulo da pagina (ex: "FortiGate", "pfSense")
  if (ws.title && !ws.url?.includes(ws.title.toLowerCase())) {
    techSet.add(ws.title);
  }

  // [NOVO] Extrair produto do CN do certificado TLS
  //   quando diferente do hostname (ex: CN="FortiGate" != hostname)
  if (ws.tls?.subject_cn) {
    const cn = ws.tls.subject_cn;
    const urlHost = ws.url ? new URL(ws.url).hostname : '';
    if (cn !== urlHost && !cn.includes('.') && !cn.includes('*')) {
      techSet.add(cn);
    }
  }
}
```

### Logica dos filtros

- **title**: Ignora titulos que sao o proprio dominio (ex: URL contem o titulo) para evitar ruido.
- **subject_cn**: Adiciona apenas quando o CN nao e um hostname (sem pontos, sem wildcard). Isso captura nomes de produto como "FortiGate", "Sophos", "PAN-OS" mas ignora CNs como "acessovpn.expansioneroma.com.br" ou "*.example.com".

### Resultado esperado

No card do IP 201.28.184.186, as badges passarao a exibir "FortiGate" alem de "HSTS" e "Let's Encrypt", identificando o produto automaticamente a partir dos dados coletados.

