

## Diagnóstico Real (Confirmado pelo DB + Logs)

O banco mostra `technologies: ["Next.js", "React"]` sem versão. Os logs do agente **não mostram NENHUM log de version probing** — nem "Found X chunk URLs", nem "Probing chunk", nem "Version probe failed". Isso significa que o bloco `if body:` na linha 379 **nunca é executado**.

**Root cause**: httpx com `-include-response` grava a resposta no campo `response` do JSON, mas dependendo da versão do httpx instalada, esse campo pode estar vazio ou não existir. O `tech` (Wappalyzer) funciona independentemente e detecta Next.js/React. Mas como `body` é vazio, todo o bloco de fingerprinting + version probing é **silenciosamente pulado**:

```python
body = entry.get('body', '') or entry.get('response', '') or ''
if body:  # ← FALSO! Nunca entra aqui
    body_techs = self._fingerprint_body(body)
    ...
    if (has_nextjs or has_react) and base_url:
        versions = self._probe_versions(base_url, body)  # ← Nunca executa
```

## Correção em `python-agent/agent/executors/httpx_executor.py`

### Mudança principal: Fallback de fetch quando body está vazio

Na `_parse_output`, **após** o bloco `if body:`, adicionar um fallback: se Next.js ou React foi detectado pelo Wappalyzer mas o body está vazio, **buscar a página nós mesmos** usando `_fetch_chunk(base_url)` e fazer o version probing no conteúdo obtido.

```python
# Após o bloco "if body:" existente (linha ~398), adicionar:

# Fallback: if Wappalyzer detected Next.js/React but body was empty,
# fetch the page ourselves for version probing
if not body:
    has_nextjs = any('Next.js' in t for t in technologies)
    has_react = any('React' in t for t in technologies)
    
    if (has_nextjs or has_react) and base_url:
        self.logger.info(f"[httpx] Body empty but Wappalyzer detected frameworks, fetching {base_url}")
        fetched_body = self._fetch_chunk(base_url)  # reuse existing method
        if fetched_body:
            # Also fingerprint the fetched body
            body_techs = self._fingerprint_body(fetched_body)
            for t in body_techs:
                if t not in technologies:
                    technologies.append(t)
            try:
                versions = self._probe_versions(base_url, fetched_body)
                if versions:
                    technologies = self._apply_versions(technologies, versions)
                    self.logger.info(f"[httpx] Fallback version probe results: {versions}")
            except Exception as e:
                self.logger.warning(f"[httpx] Fallback version probe failed: {e}")
```

### Mudança secundária: aumentar `_fetch_chunk` para páginas inteiras

O `_fetch_chunk` atual lê `MAX_CHUNK_BYTES = 51200` (50KB). O HTML do sgi.ourosafra.com.br tem ~11KB, então 50KB é suficiente. Mas para o fetch da página inicial, precisamos de mais — criar um parâmetro `max_bytes` opcional:

```python
def _fetch_chunk(self, url: str, max_bytes: int = MAX_CHUNK_BYTES) -> Optional[str]:
    ...
    return resp.read(max_bytes).decode(...)
```

E no fallback, chamar com `_fetch_chunk(base_url, max_bytes=102400)` para garantir que pega o HTML inteiro.

### Mudança terciária: logging de diagnóstico

Adicionar log quando body está vazio para facilitar debug futuro:

```python
if body:
    self.logger.info(f"[httpx] Got response body ({len(body)} bytes) for {base_url}")
else:
    self.logger.warning(f"[httpx] No response body in httpx output for {base_url}")
```

### Sobre o alerta frontend ausente

O frontend em `surfaceFindings.ts` (linhas 886-913) TEM a lógica de fallback "Next.js sem versão → alerta Medium". O `allTechs` deveria conter `["Next.js", "React"]`, e o regex `/next\.?js/i` deveria matchear. **Preciso verificar se o finding está sendo gerado mas filtrado**, ou se há um bug na construção do `assets` array. Vou adicionar um `console.log` temporário no `generateFindings` para diagnosticar se o finding está sendo criado.

## Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `httpx_executor.py` | Fallback: fetch página quando body vazio + Wappalyzer detectou frameworks |
| `httpx_executor.py` | `_fetch_chunk` aceita `max_bytes` opcional |
| `httpx_executor.py` | Logs de diagnóstico para body vazio |
| `surfaceFindings.ts` | Console.log temporário para debug do finding ausente |

