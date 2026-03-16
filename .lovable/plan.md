

## Fazer partículas deslizarem pela superfície do globo

### Diagnóstico
O comportamento atual não gera “deslocamento pela casca” do globo.

Hoje o shader faz isso:
```glsl
vec3 displaced = position * (1.0 + uAmplitude * vNoise);
displaced += vec3(uScale * uDepth * aMove * aSpeed * snoise2d(...));
```

Isso causa dois efeitos:
1. `position * (1.0 + ...)` cria deformação radial do globo
2. `+ vec3(...)` adiciona jitter em XYZ do espaço do objeto

Resultado: as partículas “pulsam”/sobem-descem e deformam a silhueta, mas não percorrem a superfície de forma visível como nas setas vermelhas.

### Abordagem
Vou trocar o deslocamento aleatório em XYZ por um deslocamento tangencial, isto é, movimento ao longo da superfície da esfera.

### Implementação proposta
1. **Preservar a rotação global**
   - Manter `ROTATION_SPEED` como está
   - Continuar girando `points.rotation.y`

2. **Separar dois tipos de movimento no shader**
   - **Deformação radial do globo**: efeito sutil de “respiração”/blob
   - **Drift tangencial das partículas**: movimento real pela superfície

3. **Calcular uma base tangente por partícula**
   - Usar a normal da esfera: `normal = normalize(position)`
   - Construir dois vetores perpendiculares à normal (`tangent` e `bitangent`)
   - Usar `aRandomness` para variar a direção de drift por partícula

4. **Mover partícula na tangente, não no raio**
   - Substituir o `vec3(...)` atual por algo como:
     - um offset em `tangent`
     - outro offset em `bitangent`
   - Combinar com noise/tempo para cada partícula parecer “escorrer” pela superfície

5. **Reprojetar na esfera**
   - Depois do drift tangencial, normalizar novamente a posição
   - Reaplicar o raio base da partícula
   - Isso evita que o globo fique “amassado” no trecho marcado em verde

6. **Separar controles**
   - `uSpeed`: velocidade do drift tangencial
   - `uAmplitude`: intensidade da deformação radial
   - opcionalmente adicionar um novo uniform para deixar isso ainda mais explícito, por exemplo:
     - `uSurfaceDriftSpeed`
     - `uSurfaceDriftAmount`

### Resultado esperado
- Algumas partículas passarão a “correr” lateralmente sobre a superfície
- O globo continuará girando independentemente
- A silhueta deixará de mostrar principalmente pulsação vertical/local
- O efeito ficará mais próximo do movimento indicado pelas setas vermelhas

### Detalhes técnicos
- O problema principal não é velocidade; é **direção do deslocamento**
- Hoje o deslocamento extra acontece em coordenadas cartesianas do objeto
- Para parecer “na superfície”, o deslocamento precisa acontecer no **plano tangente da esfera**
- Reprojetar a posição no raio da esfera é o que mantém a forma global limpa

### Arquivo a alterar
- `src/components/NetworkAnimation.tsx`

### Risco / cuidado
- Se o drift tangencial for forte demais, o globo pode parecer “ruidoso”
- Vou manter a deformação radial mais sutil do que o movimento superficial, para a leitura visual priorizar o deslizamento das partículas

