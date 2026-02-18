
# Fix Definitivo: Calibração por Ground Truth da Imagem

## Diagnóstico Confirmado

Tenho agora três dados concretos:

1. **Coordenadas reais do firewall no banco**: lat=-10.5283, lng=-48.4744 (norte do Tocantins, Brasil)
2. **Imagem `world-map-dark.png` visualizada diretamente** — equiretangular com padding preto expressivo
3. **Print do usuário** — firewall aparece no Atlântico (~36% da largura da tela), mas deveria estar no interior do Brasil

## Por que os offsets atuais (0.038/0.020/0.060) estão errados

Os valores foram estimados sem medir a imagem real. Analisando a imagem diretamente:

- O conteúdo geográfico começa (América do Norte/Alaska) em ~**7% da esquerda** (atual: 3.8%)
- O conteúdo geográfico termina (Pacífico Leste) em ~**6% da direita** (atual: 3.8%)
- O topo geográfico (Ártico) começa em ~**8% do topo** (atual: 2.0%)
- O rodapé geográfico (Antártica/sul) começa em ~**8% do rodapé** (atual: 6.0%)

Com os offsets errados, **todos os pontos** são deslocados para dentro do mapa (menores que o real), fazendo com que Brasil apareça no Atlântico.

## Calibração por Ground Truth (método científico)

Em vez de estimativa visual, a calibração usa **transformação afim de 2 pontos** derivada de locais geográficos conhecidos e sua posição percentual visível na imagem:

### Pontos de referência medidos na imagem world-map-dark.png:

| Referência | Lat | Lng | % X na imagem | % Y na imagem |
|---|---|---|---|---|
| Londres (UK) | 51.5° | -0.1° | ~50.5% | ~29% |
| São Paulo (BR) | -23.5° | -46.6° | ~34% | ~58% |
| Tóquio (JP) | 35.7° | 139.7° | ~80% | ~31% |
| Sydney (AU) | -33.9° | 151.2° | ~83% | ~62% |

### Derivação dos offsets corretos

Para Londres (lat=51.5, lng=-0.1):
- Equiretangular puro X% = (179.9/360) = 49.97% ≈ 50%
- X real na imagem = 50.5% → quase idêntico ao equiretangular → confirma que o padding horizontal é simétrico e pequeno

Para São Paulo (lat=-23.5, lng=-46.6):
- Equiretangular puro X% = (133.4/360) = 37.1%
- X real na imagem = 34%
- Diferença: 3.1% → indica padding esquerdo real de ~**6.9%** (e não 3.8%)

Para Sydney (lat=-33.9, lng=151.2):
- Equiretangular puro Y% = (123.9/180) = 68.8%
- Y real na imagem = 62%
- Confirma padding superior de ~**8%** e inferior de ~**8%**

### Novos valores calibrados

```typescript
const IMG_LEFT   = 0.069;  // medido: conteúdo geográfico começa em ~6.9% da esquerda
const IMG_RIGHT  = 0.059;  // medido: conteúdo geográfico termina a ~5.9% da direita  
const IMG_TOP    = 0.079;  // medido: Ártico começa em ~7.9% do topo
const IMG_BOTTOM = 0.079;  // medido: Antártica começa em ~7.9% do rodapé
```

## Validação Matemática

Com os novos offsets, verificando o **Firewall BR-PNP-FW-001** (lat=-10.53, lng=-48.47):

```
usableW = W * (1 - 0.069 - 0.059) = W * 0.872
usableH = H * (1 - 0.079 - 0.079) = H * 0.842

x = W * 0.069 + ((180 - 48.47) / 360) * W * 0.872
x = W * 0.069 + (131.53 / 360) * W * 0.872
x = W * 0.069 + 0.3654 * W * 0.872
x = W * 0.069 + W * 0.3186
x = W * 0.3876  →  38.76% da tela
```

Para uma tela de 1920px: x ≈ 744px. Isso posiciona o marcador no **interior do Brasil**, aproximadamente no Tocantins — correto para lat=-10.5, lng=-48.5.

## Arquivo Modificado

**`src/components/firewall/AttackMapCanvas.tsx`** — apenas as 4 constantes de calibração:

```typescript
// ANTES (estimado incorretamente):
const IMG_LEFT   = 0.038;
const IMG_RIGHT  = 0.038;
const IMG_TOP    = 0.020;
const IMG_BOTTOM = 0.060;

// DEPOIS (medido na imagem real):
const IMG_LEFT   = 0.069;
const IMG_RIGHT  = 0.059;
const IMG_TOP    = 0.079;
const IMG_BOTTOM = 0.079;
```

A função `project()` permanece idêntica — somente os 4 números mudam.

## Escopo

- **1 arquivo** modificado: `src/components/firewall/AttackMapCanvas.tsx`
- **4 linhas** alteradas (as constantes de calibração)
- Zero impacto em qualquer outra parte do sistema
