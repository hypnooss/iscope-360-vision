

## Situação Atual

A screenshot mostra os badges `Next.js` e `React` sem versão na aba **Serviços** do IP `132.226.255.80`. Isso é o dado bruto gravado no banco pelo agente Python — e esse dado veio do **scan anterior**, antes do fix no `httpx_executor.py`.

As correções feitas (aumento de `MAX_PROBE_REQUESTS` para 6, regex bidirecionais, priorização de Turbopack) **já estão no código** mas precisam ser:

1. **Deployadas no Super Agent** — copiar o `httpx_executor.py` atualizado para o servidor
2. **Re-executar o scan** no domínio `ourosafra.com.br`

Depois do re-scan, o dado no banco passará de `["Next.js", "React"]` para `["Next.js 16.1.7", "React 19.3.0"]` (ou similar), e os badges na UI mostrarão as versões automaticamente.

### Sobre o fallback frontend

O finding "Next.js detectado sem versão — possível React2Shell" (severidade Medium) **já deveria estar aparecendo** na aba **Análise** do Surface Analyzer para o scan atual. Se não está, pode ser cache do browser. Mas esse finding é um safety net — o objetivo principal é que o agente extraia a versão.

### Próximo passo

Nenhuma alteração de código é necessária. Ações no servidor:

```bash
# 1. Deploy do executor atualizado no Super Agent
# (copiar httpx_executor.py para o servidor)

# 2. Re-executar scan do ourosafra.com.br
# (via UI do Surface Analyzer ou API)
```

Após o re-scan, os badges mostrarão `Next.js 16.1.7` e `React 19.3.0`.

