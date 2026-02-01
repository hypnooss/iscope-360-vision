

## Alinhamento dos Elementos do Header + Background Cyber-Grid

### Problema Atual
1. O logo está posicionado com `right: 0` no container, mas o container tem padding, então ele fica desalinhado com onde a linha degradê termina
2. Os textos da segunda linha também não estão alinhados com os limites da linha
3. Falta o background cyber-grid que aparece na web

### Solução

**Arquivo:** `src/components/pdf/sections/PDFHeader.tsx`

#### 1. Remover o padding interno do container e usar uma View interna para o conteúdo

Atualmente o container aplica padding horizontal, mas a linha degradê ignora isso (usa `width: 100%`). Vamos criar uma estrutura onde a linha ocupe toda a largura e o conteúdo respeite os limites:

```
Container (fundo azul escuro + grid, sem padding horizontal interno)
├── TopRow (com paddingHorizontal próprio)
│   ├── Título "iScope 360" centralizado
│   └── Logo alinhado à direita COM limite do padding
├── Linha Degradê (largura 100%, SEM padding - pega toda largura)
└── InfoRow (com paddingHorizontal próprio)
    ├── Esquerda: Tipo + Domínio (alinhado com início da linha)
    └── Direita: Data + Workspace (alinhado com fim da linha)
```

#### 2. Adicionar Background Cyber-Grid via SVG

Como o `@react-pdf/renderer` não suporta CSS `background-image`, vamos criar um grid SVG sobreposto:

```tsx
// Grid pattern - linhas teal com 3% opacidade, 40px spacing
<Svg style={styles.gridOverlay} viewBox="0 0 500 150">
  {/* Linhas verticais */}
  {[0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480].map(x => (
    <Rect key={`v${x}`} x={x} y={0} width={1} height={150} fill="#14B8A6" fillOpacity={0.03} />
  ))}
  {/* Linhas horizontais */}
  {[0, 40, 80, 120].map(y => (
    <Rect key={`h${y}`} x={0} y={y} width={500} height={1} fill="#14B8A6" fillOpacity={0.03} />
  ))}
</Svg>
```

#### 3. Alterações nos Estilos

```typescript
// Container sem padding horizontal interno
container: {
  backgroundColor: headerBg,
  marginLeft: -(spacing.pageHorizontal + 1),
  marginRight: -(spacing.pageHorizontal + 1),
  marginTop: -spacing.page,
  paddingTop: spacing.sectionGap,
  paddingBottom: spacing.sectionGap,
  marginBottom: spacing.sectionGap,
  position: 'relative', // Para posicionar o grid como overlay
},

// Conteúdo interno com padding
contentRow: {
  paddingHorizontal: spacing.pageHorizontal + 1,
},

// Grid overlay
gridOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
},

// TopRow agora com padding próprio
topRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 12,
  position: 'relative',
  minHeight: 60,
  paddingHorizontal: spacing.pageHorizontal + 1, // Alinha com limites da linha
},

// Logo container agora respeita o padding
logoContainer: {
  position: 'absolute',
  right: spacing.pageHorizontal + 1, // Alinhado com fim da linha
},

// InfoRow com padding próprio
infoRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginTop: 0,
  paddingHorizontal: spacing.pageHorizontal + 1, // Alinha com limites da linha
},
```

### Resultado Visual Esperado

```
┌─────────────────────────────────────────────────────────────────┐
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ (cyber-grid) │
│     │                                            │    LOGO    │
│     │              iScope 360                    │      ↑     │
│     │                                            │   alinhado │
│═════════════════════════════════════════════════════════════════│ ← linha degradê
│     │                                            │      ↓     │
│     │ Análise de Domínio           Data: xxx     │   alinhado │
│     │ **dominio.com**              Workspace: xxx│             │
│     ↑                                            ↑             │
│   início alinhado                           fim alinhado       │
└─────────────────────────────────────────────────────────────────┘
```

