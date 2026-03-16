

## Replicar o Globo da Maze no NetworkAnimation

### Análise Visual da Maze vs Nosso Globo

Baseado na análise do screenshot e código-fonte da Maze:

**O que a Maze faz diferente:**

1. **Densidade muito maior de partículas** — O globo deles é extremamente denso, parecendo quase uma esfera sólida com textura granulada. O nosso tem 4.000 partículas; o deles parece ter 15.000-25.000.

2. **Paleta de cores com gradiente radial** — O centro da esfera é um azul escuro/navy profundo, e as bordas (silhueta) brilham em tons de cyan/teal (#22D0DF) e magenta/rosa (#C850C0). O nosso usa teal uniforme com variações sutis demais.

3. **Partículas menores e mais uniformes** — As partículas da Maze são muito pequenas (quase 1px), criando uma textura "granulada" ao invés de pontos visíveis individuais. O nosso tem partículas variando de 0.4 a 1.2px.

4. **Efeito de "atmosfera" nas bordas** — A silhueta da esfera tem uma dispersão de partículas que se espalham além do raio, criando um halo difuso. 

5. **Opacidade baseada na profundidade muito mais dramática** — O lado de trás da esfera é quase invisível (alpha ~0.01), criando um contraste forte com o lado frontal.

6. **Fundo integrado** — O canvas da Maze é fixo (position: fixed) e cobre toda a página, usando Three.js com WebGL. O nosso usa Canvas 2D.

7. **Rotação mais lenta e suave** — A rotação parece ser ~50% mais lenta que a nossa.

---

### Mudanças no `src/components/NetworkAnimation.tsx`

**1. Aumentar partículas para ~18.000**
- `PARTICLE_COUNT = 18000`

**2. Partículas menores e mais uniformes**
- `baseSize: 0.15 + Math.random() * 0.35` (era 0.4-1.2)

**3. Reduzir velocidade de rotação**
- `ROTATION_SPEED = 0.00008` (era 0.00015)

**4. Nova paleta: bordas cyan/magenta, centro azul escuro**
- Calcular cor baseada na posição angular (silhueta vs centro)
- Centro da face frontal: azul navy escuro (20, 30, 60)
- Bordas/silhueta: cyan (#22D0DF → rgb 34, 208, 223) transitioning para magenta (#C850C0 → rgb 200, 80, 192)
- Usar o ângulo da normal da esfera relativo à câmera para definir "borda vs centro"

**5. Opacidade mais dramática**
- Back face: alpha ~0.01-0.03 (quase invisível)
- Front face center: alpha ~0.25-0.4 (mais sutil que agora)
- Edge/silhueta: alpha ~0.6-0.9 (brilhante)

**6. Efeito de dispersão na silhueta**
- 10% das partículas com `radiusMul` até 1.08 (espalhando além do raio)
- Concentrar dispersão nas partículas de borda

**7. Remover glow individual (pesado com 18k partículas)**
- Eliminar o bloco de `createRadialGradient` para performance

**8. Lógica de cor por silhueta (novo algoritmo)**
```text
Para cada partícula projetada:
  1. Calcular vetor normal da superfície (nx, ny, nz normalizado)
  2. dot = abs(nz / sphereRadius) → 0 = borda, 1 = centro
  3. edgeFactor = 1 - dot (0 = centro, 1 = borda)
  
  Se edgeFactor > 0.6 (borda):
    Misturar cyan (34,208,223) e magenta (200,80,192) 
    baseado em ângulo vertical (phi)
  Senão (centro):
    Azul navy escuro (20, 40, 80) com teal sutil
```

### Arquivos afetados
- `src/components/NetworkAnimation.tsx` — reescrever lógica de cor, tamanho, densidade e opacidade

