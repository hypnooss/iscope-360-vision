

# Fix: Alinhamento do Mapa de Ataques

## Problema

Os firewalls BAU-FW e BR-PMP-FW-001 tem coordenadas corretas no banco:
- BAU-FW: lat=-22.32, lng=-49.06 (Bauru, SP)
- BR-PMP-FW-001: lat=-18.73, lng=-46.67 (Patos de Minas, MG)

A projecao matematica tambem esta correta, gerando pontos dentro do viewBox 1000x500. O problema e o **desalinhamento entre a imagem de fundo (CSS) e o SVG overlay**.

### Causa raiz

O SVG usa `preserveAspectRatio="xMidYMid meet"` que mantem proporcao 2:1 e centraliza dentro do container. A imagem de fundo usa `backgroundSize: cover` que preenche todo o container e corta o excedente. Quando o container nao tem proporcao exata 2:1 (especialmente em fullscreen), o mapa de fundo e os pontos do SVG ficam desalinhados.

```text
Container (ex: 1920x900, nao e 2:1)
+------------------------------------------+
|  Imagem de fundo: cover (preenche tudo)  |
|  +------------------------------------+  |
|  | SVG: meet (mantem 2:1, centraliza) |  |
|  |  * pontos aqui nao batem com mapa  |  |
|  +------------------------------------+  |
+------------------------------------------+
```

## Solucao

Mover a imagem do mapa para dentro do SVG como um elemento `<image>`, eliminando o uso de CSS background. Assim, mapa e pontos compartilham o mesmo sistema de coordenadas e ficam sempre alinhados.

## Detalhes tecnicos

### Arquivo: `src/components/firewall/AttackMap.tsx`

1. **Remover** o `backgroundImage` do style do container div
2. **Adicionar** um `<image>` SVG como primeiro filho do `<svg>`:
   ```
   <image href={worldMapDark} x="0" y="0" width="1000" height="500" preserveAspectRatio="xMidYMid slice" />
   ```
3. Manter o `preserveAspectRatio="xMidYMid meet"` no elemento `<svg>` para que tudo escale junto
4. Ajustar o container div para nao ter background-image, apenas background-color preto (fullscreen) ou transparente (inline)

### Mudanca especifica

No container div, remover:
```
backgroundImage: `url(${worldMapDark})`,
backgroundSize: 'cover',
backgroundPosition: 'center',
backgroundRepeat: 'no-repeat',
```

No SVG, adicionar antes dos filtros:
```
<image href={worldMapDark} x="0" y="0" width="1000" height="500" />
```

Definir `preserveAspectRatio="xMidYMid meet"` no SVG para ambos os modos (inline e fullscreen), garantindo alinhamento consistente.

### Resumo de arquivos

| Arquivo | Mudanca |
|---------|---------|
| `AttackMap.tsx` | Mover imagem de fundo para dentro do SVG como `<image>`, remover CSS background |

