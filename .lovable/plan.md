

## Diagnóstico: Por que o globo "quebrou"

O problema é que os valores uniformes do MazeHQ foram aplicados assumindo que a geometria é igual, mas **não é**. O MazeHQ carrega modelos 3D (`.glb`) com vértices em escala diferente da nossa esfera unitária (raio ~1.0). Com `uFrequency: 0.01`, o noise recebe `position * 0.01` ≈ valores ~0.01, produzindo ruído quase zero para todas as partículas. Resultado: cor uniforme, sem deformação orgânica, globo praticamente invisível.

## Plano: Restaurar o globo funcional

**Arquivo: `src/components/NetworkAnimation.tsx`**

1. **Restaurar `uFrequency` para valor que funciona na nossa geometria** — como nossas posições estão em esfera unitária (~1.0), precisamos de `uFrequency` mais alto para gerar variação de noise visível. Valor anterior funcional era em torno de `1.2`. Vou usar `0.8` como meio-termo que produz noise orgânico sem ser excessivo.

2. **Restaurar `uAmplitude`** — `0.1` causa deformação exagerada na esfera unitária (10% do raio). Usar `0.04` para deformação sutil e orgânica.

3. **Restaurar `uDepth`** — `0.3` causa scatter excessivo. Usar `0.15` para drift suave das partículas.

4. **Manter as melhorias do shader** — A estrutura do vertex/fragment shader (displacement simplificado no estilo MazeHQ, gaussian glow no fragment) está correta. O problema são apenas os valores dos uniforms.

5. **Manter as cores do MazeHQ** — Os valores de cor `(40, 197, 234)` e `(202, 50, 223)` estão corretos e funcionam independente da escala.

### Resumo dos valores

| Uniform | Valor quebrado | Valor restaurado |
|---------|---------------|-----------------|
| uFrequency | 0.01 | 0.8 |
| uAmplitude | 0.1 | 0.04 |
| uDepth | 0.3 | 0.15 |
| uSize | 10.0 | 10.0 (mantém) |
| Cores | MazeHQ | MazeHQ (mantém) |

Isso restaura o globo visível com variação de cor e deformação orgânica, mantendo todas as melhorias de shader e a transição sand/morph intactas.

