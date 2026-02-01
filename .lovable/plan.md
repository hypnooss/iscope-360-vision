

## Reorganização do Header do PDF

### Objetivo
Reorganizar os elementos do header conforme indicado na imagem de referência:

### Layout Atual
```
Linha 1: [Logo + iScope 360]          [Data + Workspace]
Linha 2: [Análise de Domínio Externo]
         [agudos.sp.gov.br]
```

### Novo Layout Desejado
```
Linha 1: [iScope 360]                        [Logo]
Linha 2: [Análise de Domínio Externo]        [Data]
         [agudos.sp.gov.br]                  [Workspace]
```

### Alterações Técnicas

**Arquivo:** `src/components/pdf/sections/PDFHeader.tsx`

1. **Linha 1 (topRow):**
   - Lado esquerdo: apenas o texto "iScope 360" (remover logo daqui)
   - Lado direito: mover o logo para cá

2. **Linha 2 (infoSection):**
   - Transformar em layout flexbox row com `justifyContent: 'space-between'`
   - Lado esquerdo: manter "Análise de Domínio Externo" e domínio
   - Lado direito: mover data e workspace para cá

### Estrutura JSX Resultante

```jsx
<View style={styles.container}>
  {/* Linha 1: Título + Logo */}
  <View style={styles.topRow}>
    <Text style={styles.brandText}>{title}</Text>
    {logoBase64 && <Image style={styles.logo} src={logoBase64} />}
  </View>

  {/* Linha 2: Info + Metadata */}
  <View style={styles.infoRow}>
    <View style={styles.leftColumn}>
      <Text style={styles.reportType}>{reportType}</Text>
      <Text style={styles.target}>{target}</Text>
    </View>
    <View style={styles.rightColumn}>
      <Text style={styles.dateText}>{date}</Text>
      {subtitle && <Text style={styles.workspaceName}>Workspace: {subtitle}</Text>}
    </View>
  </View>
</View>
```

### Ajustes de Estilo
- Remover `paddingLeft` da infoSection (não precisa mais alinhar com logo)
- Adicionar `flexDirection: 'row'` e `justifyContent: 'space-between'` na nova `infoRow`
- Ajustar alinhamento vertical dos elementos

