

## Problema

Dos 18 chunks JS, o agente proba apenas 6 (`MAX_PROBE_REQUESTS = 6`) e para. O chunk com a versão do React está entre os 12 restantes. No shell, o usuário provavelmente testou todos ou acertou o chunk certo.

Adicionalmente, o chunk `turbopack-*.js` é classificado com prioridade 1 (alto) mas é apenas o module loader — nunca contém versões. Isso desperdiça 1 probe.

## Correções em `python-agent/agent/executors/httpx_executor.py`

### 1. Aumentar `MAX_PROBE_REQUESTS` de 6 para 15
Com 18 chunks, 6 é insuficiente. 15 cobre a grande maioria dos builds.

### 2. Rebaixar prioridade do chunk `turbopack`
Mudar prioridade de `turbopack` de 1 para 5 (mesmo nível de generic), pois o runtime loader nunca contém versões. Manter `framework` como prioridade 0.

### 3. Adicionar logging do conteúdo dos chunks
Para cada chunk probado sem match, logar os primeiros 200 caracteres para diagnóstico futuro:
```python
if 'React' not in versions and 'Next.js' not in versions:
    self.logger.debug(f"[httpx] No version in {chunk_type} chunk, preview: {content[:200]}")
```

### 4. Fallback Turbopack (manter do plano anterior)
Após probar todos os chunks sem encontrar versão, se `TURBOPACK` ou `globalThis.TURBOPACK` foi detectado em qualquer chunk → inferir `Next.js 15+` e `React 19+`.

## Mudanças no `surfaceFindings.ts`
Sem mudanças adicionais — os console.logs de debug já foram adicionados.

## Resumo

| Mudança | Arquivo |
|---------|---------|
| `MAX_PROBE_REQUESTS` 6→15 | `httpx_executor.py` L81 |
| Prioridade turbopack 1→5 | `httpx_executor.py` L230 |
| Debug log de conteúdo de chunk | `httpx_executor.py` ~L307 |
| Fallback Turbopack → Next.js 15+ / React 19+ | `httpx_executor.py` ~L328 |

