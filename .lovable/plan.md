
## Diagnóstico

A execução mais recente para `132.226.255.80` mostra `"technologies": ["Next.js", "React"]` — **sem versão**. O probing de versão falhou silenciosamente.

### Causa raiz

O site `sgi.ourosafra.com.br` usa **Next.js App Router** (evidência: `next-route-announcer`, `data-nimg`, ausência de `__NEXT_DATA__`). O código atual de `_extract_chunk_urls()` procura chunks com nomes **Pages Router**:

```text
CHUNK_PATTERNS = [
    framework-[a-f0-9]+.js    ← Pages Router only
    main-[a-f0-9]+.js         ← Pages Router only  
    webpack-[a-f0-9]+.js      ← Pages Router only
    pages/_app-[a-f0-9]+.js   ← Pages Router only
]
```

O App Router usa nomes como:
- `/_next/static/chunks/[hash].js` (hashes genéricos sem prefixo)
- `/_next/static/chunks/app/layout-[hash].js`
- `/_next/static/[buildId]/_ssgManifest.js`

Nenhum desses é capturado pelos padrões atuais, então `_extract_chunk_urls()` retorna lista vazia e o probing é pulado.

Além disso, o `__NEXT_DATA__` check também falha porque App Router não usa esse script tag.

## Plano de correção (2 partes)

### Parte 1: `python-agent/agent/executors/httpx_executor.py` — Expandir extração de chunks

Substituir a abordagem de padrões fixos por uma extração genérica de **todos** os scripts `/_next/static/` do HTML:

1. **Novo `SCRIPT_SRC_RE` mais abrangente**: extrair TODAS as URLs `/_next/static/chunks/*.js` do body
2. **Classificação heurística**: se o filename contém `framework` → tipo `framework`; senão → tipo `generic`
3. **Probing genérico**: buscar padrões de versão React/Next.js em qualquer chunk `.js`, não apenas nos nomeados
4. **Fallback adicional**: se nenhum chunk encontrado no HTML, tentar construir URL `/_next/static/chunks/` a partir do `buildId` extraído do HTML

Mudanças específicas no `_extract_chunk_urls()`:
```python
# Antes: só captura chunks com nomes específicos (Pages Router)
# Depois: captura QUALQUER script src que contenha /_next/static/
NEXT_CHUNK_RE = re.compile(r'/_next/static/[^"\']+\.js')

# Extrair todos os JS do /_next/static/ e priorizá-los:
# 1. framework-*.js (React version)
# 2. Qualquer outro chunk (pode ter versões)
```

Também adicionar mais padrões de versão:
```python
# App Router pode expor versão no buildManifest ou em qualquer chunk
REACT_VERSION_PATTERNS += [
    re.compile(r'version:"(\d+\.\d+\.\d+)"'),  # minified
    re.compile(r'\.version="(\d+\.\d+\.\d+)"'),
]
```

### Parte 2: `src/lib/surfaceFindings.ts` — Fallback para Next.js sem versão

Após a seção 5 (EOL_RULES loop, linha ~879), adicionar ~25 linhas de verificação:

- Se um asset tem "Next.js" em `allTechs` mas nenhuma entry matcha `/next[.\/-]?js[\/:\s]?\d/i`, gerar finding **medium** com nome "Next.js detectado sem versão — possível React2Shell (CVE-2025-29927)"
- Recomendação: "Re-executar scan ou verificar manualmente os JS bundles"

Isso garante que mesmo quando o probing de versão falha, o risco é sinalizado.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `python-agent/agent/executors/httpx_executor.py` | Expandir `CHUNK_PATTERNS` e `_extract_chunk_urls()` para capturar chunks App Router; adicionar mais regex de versão |
| `src/lib/surfaceFindings.ts` | Adicionar fallback de finding medium para Next.js sem versão detectada |
