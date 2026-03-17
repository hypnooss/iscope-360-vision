

## Problema Confirmado

A evidência manual prova que:
- O HTML **tem** 18 `<script>` tags com chunks `/_next/static/`
- O chunk `41ba81e97c0504dd.js` contém `version="19.3.0"` (React 19.3.0)
- O chunk `5e7be368af53d513.js` contém `version:"16.1.7"` (provavelmente Next.js 16)
- O executor só proba **3 chunks** (`MAX_PROBE_REQUESTS = 3`) e o chunk do React é o **4º** na ordem alfabética

## Correções em `python-agent/agent/executors/httpx_executor.py`

### 1. Aumentar `MAX_PROBE_REQUESTS` de 3 para 6

Linha 74: `MAX_PROBE_REQUESTS = 6`

Com 18 chunks genéricos, 3 é insuficiente. 6 cobre a maioria dos casos sem impacto significativo de performance (cada fetch é ~50KB com timeout de 5s).

### 2. Adicionar regex bidirecional para version patterns (Turbopack)

O Turbopack usa `version="19.3.0"` sem necessariamente ter "react" logo depois. Adicionar patterns que checam "react" ANTES do version:

```python
# Turbopack/App Router: react-dom antes, version depois
re.compile(r'react[.-]?dom[^{]*?version="(\d+\.\d+\.\d+)"', re.IGNORECASE),
re.compile(r'react[.-]?dom[^{]*?version:"(\d+\.\d+\.\d+)"', re.IGNORECASE),
```

E para Next.js:
```python
re.compile(r'next[^{]*?version="(\d+\.\d+\.\d+)"', re.IGNORECASE),
re.compile(r'next[^{]*?version:"(\d+\.\d+\.\d+)"', re.IGNORECASE),
```

### 3. Heurística de classificação para Turbopack chunks

Atualmente todos os chunks são `generic`. Adicionar detecção do chunk `turbopack-*.js` como tipo `turbopack` com prioridade alta (pode conter metadata de versões):

```python
# No PAGES_ROUTER_CHUNK_PATTERNS, adicionar:
(re.compile(r'turbopack-[a-f0-9]+\.js'), 'turbopack'),
```

E na prioridade de sort:
```python
priority = {'framework': 0, 'turbopack': 1, 'main': 2, 'webpack': 3, 'app': 4, 'generic': 5}
```

### Resumo das mudanças

| Linha | Alteração |
|-------|-----------|
| 74 | `MAX_PROBE_REQUESTS = 3` → `6` |
| 39-51 | Adicionar 2 regex bidirecionais (react-dom...version) |
| 54-62 | Adicionar 2 regex bidirecionais (next...version) |
| 65-70 | Adicionar pattern `turbopack-*.js` |
| 223 | Adicionar `turbopack` na prioridade de sort |

Nenhuma alteração no frontend — o fallback "Next.js sem versão" já está lá como safety net.

