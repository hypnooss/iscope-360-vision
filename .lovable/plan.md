

## Problema

O `httpx_executor.py` detecta "Next.js" e "React" via regex no HTML, mas **sem versão**. O motor de findings (`surfaceFindings.ts`) precisa de strings versionadas como `"Next.js 14.2.3"` ou `"React 18.2.0"` para acionar os alertas React2Shell (CVE-2025-29927).

O HTML renderizado de SPAs Next.js não expõe versões diretamente — elas estão embutidas nos JS bundles (`/_next/static/chunks/`).

## Estratégia

Adicionar **probing de versão** no `httpx_executor.py`: quando Next.js é detectado no HTML, fazer requests HTTP secundários a URLs conhecidos que vazam versão.

### Fontes de versão em apps Next.js

1. **`/_next/static/chunks/framework-*.js`** — contém React bundled com string de versão (ex: `"18.2.0"`)
2. **`/_next/static/chunks/main-*.js`** ou **`/_next/static/chunks/webpack-*.js`** — pode conter Next.js version
3. **Script tags no HTML** — referências a `/_next/static/<buildId>/...` contêm hashes dos chunks

### Plano de implementação

#### 1. `httpx_executor.py` — Adicionar `_probe_versions()`

Novo método que:
1. Extrai URLs de script tags do HTML body via regex (`src="/_next/static/chunks/..."`)
2. Faz requests HTTP (via `urllib.request`) aos chunks encontrados (limite: 3 requests, timeout 5s cada)
3. Busca padrões de versão nos primeiros 50KB de cada chunk:
   - React: `"react".*?"(\d+\.\d+\.\d+)"` ou `version:"18.2.0"`
   - Next.js: `"Next.js".*?"(\d+\.\d+\.\d+)"` ou `next@(\d+\.\d+\.\d+)`
4. Retorna versões encontradas

#### 2. `httpx_executor.py` — Atualizar `_fingerprint_body()` → `_fingerprint_body_and_versions()`

Modificar para retornar tecnologias **com versão** quando disponível:
- Se Next.js detectado e versão encontrada → `"Next.js 14.2.3"` em vez de `"Next.js"`
- Se React detectado e versão encontrada → `"React 18.2.0"` em vez de `"React"`
- Se versão não encontrada → mantém sem versão (fallback seguro)

#### 3. `_parse_output()` — Chamar probing após fingerprint

No loop de parsing, quando `_fingerprint_body` detecta Next.js:
1. Extrair base URL do `entry['url']`
2. Chamar `_probe_versions(base_url, body)` 
3. Substituir entries em `technologies` com versões encontradas

### Detalhes técnicos do probing

```python
VERSION_PROBES = [
    # (url_pattern_in_html, version_regex, tech_name)
    (r'/_next/static/chunks/(framework-[a-f0-9]+\.js)', 
     r'"(\d+\.\d+\.\d+)"', 'React'),
    (r'/_next/static/chunks/(main-[a-f0-9]+\.js)',
     r'version["\s:=]+["\'](\d+\.\d+\.\d+)', 'Next.js'),
    (r'/_next/static/chunks/(webpack-[a-f0-9]+\.js)',
     r'version["\s:=]+["\'](\d+\.\d+\.\d+)', 'Next.js'),
]
```

Fallback: se nenhum chunk URL é encontrado no HTML, tentar URLs padrão conhecidos:
- `/_next/static/chunks/framework.js`
- `/_next/static/chunks/main.js`

### Segurança e performance

- Timeout de 5s por request secundário
- Máximo 3 requests de probing por URL
- Scan apenas dos primeiros 50KB de cada JS file
- Não bloqueia o resultado principal — se probing falhar, retorna tecnologias sem versão

### Nenhuma alteração no frontend

O `surfaceFindings.ts` já tem as regex corretas para strings versionadas (`/react[\/:\s]?(15\.|16\.|17\.)/i`, `/next[.\/-]?js[\/:\s]?(9\.|10\.|11\.|12\.|13\.|14\.)/i`). Basta que o executor envie "React 17.0.2" ou "Next.js 14.2.3" em `technologies[]` para os findings React2Shell serem acionados automaticamente.

