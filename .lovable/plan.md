

## Partículas estáticas — diagnóstico e correção

### Problema

O `uTime` que alimenta o shader evolui de forma extremamente lenta:

```
uniforms.uTime.value = elapsed * 0.008;
```

Isso significa que após 1 segundo, `uTime` vale apenas `0.008`. O movimento das partículas no shader usa `snoise2d(vec2(aIndex, uTime * uSpeed))`, resultando em variação de `0.008 × 0.35 = 0.0028` por segundo — imperceptível.

### Solução

Aumentar o multiplicador de `uTime` de `0.008` para `0.15` na linha 316. Isso fará as partículas se moverem visivelmente na superfície sem alterar a rotação do globo (que é independente).

| Parâmetro | Atual | Novo |
|-----------|-------|------|
| Multiplicador de `uTime` (linha 316) | `0.008` | `0.15` |

Resultado: após 1 segundo, `uTime` valerá `0.15` em vez de `0.008`, e o noise das partículas variará `0.15 × 0.35 = 0.0525` por segundo — movimento suave e visível.

