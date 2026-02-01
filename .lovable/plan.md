

## Linha Decorativa Degradê no Header do PDF

### Objetivo
Adicionar uma linha horizontal branca com efeito degradê (transparente nas pontas → branco no centro → transparente nas pontas) entre a linha do título "iScope 360" e a linha de informações do relatório.

### Viabilidade Técnica
O `@react-pdf/renderer` suporta gradientes SVG nativamente através dos componentes:
- `Svg` - Container SVG
- `Defs` - Definições de gradientes
- `LinearGradient` - Gradiente linear
- `Stop` - Pontos de cor do gradiente
- `Rect` - Retângulo para aplicar o gradiente

### Implementação

**Arquivo:** `src/components/pdf/sections/PDFHeader.tsx`

1. **Importar componentes SVG:**
```typescript
import { View, Text, Image, Svg, Defs, LinearGradient, Stop, Rect, StyleSheet } from '@react-pdf/renderer';
```

2. **Criar componente de linha degradê:**
```tsx
const GradientLine = () => (
  <View style={styles.gradientLineContainer}>
    <Svg width="100%" height={1} viewBox="0 0 500 1">
      <Defs>
        <LinearGradient id="headerGradient" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.1} />
          <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="500" height="1" fill="url(#headerGradient)" />
    </Svg>
  </View>
);
```

3. **Adicionar estilo do container:**
```typescript
gradientLineContainer: {
  width: '100%',
  height: 1,
  marginBottom: 16,
},
```

4. **Inserir no JSX entre topRow e infoRow:**
```tsx
<View style={styles.container}>
  {/* Linha 1: Título + Logo */}
  <View style={styles.topRow}>
    <Text style={styles.brandText}>{title}</Text>
    {logoBase64 && (
      <View style={styles.logoContainer}>
        <Image style={styles.logo} src={logoBase64} />
      </View>
    )}
  </View>

  {/* Linha decorativa degradê */}
  <GradientLine />

  {/* Linha 2: Info + Metadata */}
  <View style={styles.infoRow}>
    ...
  </View>
</View>
```

### Estrutura do Gradiente
```
Esquerda          Centro          Direita
   |                |                |
   ▼                ▼                ▼
10% opaco  →  100% opaco  →  10% opaco
(quase transparente) (branco sólido) (quase transparente)
```

### Ajustes de Espaçamento
- Reduzir `marginBottom` do `topRow` de 24 para 12 (a linha ocupará parte do espaço)
- Adicionar `marginBottom: 16` no container da linha para espaço antes do infoRow

