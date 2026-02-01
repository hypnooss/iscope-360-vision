

## Aviso de Segurança sobre Evidências no PDF

### Objetivo
Adicionar um aviso informativo nos relatórios PDF explicando que, por questões de segurança, as evidências coletadas não são exibidas nos relatórios exportados.

### Análise das Opções de Posicionamento

| Local | Vantagem | Desvantagem |
|-------|----------|-------------|
| Página de Detalhamento (após título) | Fica próximo de onde as evidências seriam exibidas | Só aparece se houver categorias com falhas |
| Rodapé fixo | Aparece em todas as páginas | Pode poluir visualmente, espaço limitado |
| Página 1 (Resumo Executivo) | Visibilidade imediata | Pode parecer deslocado do contexto |

**Recomendação**: Adicionar na página de "Detalhamento por Categoria", logo abaixo do título "Detalhamento por Categoria", pois é onde o usuário esperaria ver mais detalhes das verificações.

### Implementação

**Arquivo**: `src/components/pdf/ExternalDomainPDF.tsx`

1. Criar um componente de aviso estilizado com ícone de informação
2. Posicioná-lo entre o título "Detalhamento por Categoria" e as seções de categoria
3. Usar cores neutras (azul/cinza) para não parecer um erro

```text
Estrutura Visual do Aviso:
┌─────────────────────────────────────────────────────────────────┐
│  ℹ  Por questões de segurança, as evidências coletadas não     │
│     são exibidas em relatórios exportados para PDF.            │
└─────────────────────────────────────────────────────────────────┘
```

**Arquivo**: `src/components/pdf/FirewallPDF.tsx`

Aplicar o mesmo aviso para manter consistência entre os relatórios.

### Detalhes Técnicos

Adicionar estilos no `pageStyles`:
```typescript
securityNotice: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#EFF6FF',  // Azul claro (info)
  borderRadius: 6,
  padding: 12,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: '#BFDBFE',
  borderLeftWidth: 4,
  borderLeftColor: '#3B82F6',  // Azul primário
},
noticeIcon: {
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: '#3B82F6',
  marginRight: 10,
  alignItems: 'center',
  justifyContent: 'center',
},
noticeIconText: {
  fontSize: 12,
  fontFamily: typography.bold,
  color: '#FFFFFF',
},
noticeText: {
  flex: 1,
  fontSize: typography.bodySmall,
  color: '#1E40AF',  // Azul escuro
  lineHeight: 1.4,
},
```

Adicionar JSX na página de detalhamento:
```tsx
<Text style={pageStyles.pageTitle}>
  Detalhamento por Categoria
</Text>

{/* Aviso de Segurança */}
<View style={pageStyles.securityNotice}>
  <View style={pageStyles.noticeIcon}>
    <Text style={pageStyles.noticeIconText}>i</Text>
  </View>
  <Text style={pageStyles.noticeText}>
    Por questões de segurança, as evidências coletadas não são exibidas em relatórios exportados para PDF.
  </Text>
</View>
```

### Arquivos a Modificar

1. `src/components/pdf/ExternalDomainPDF.tsx` - Adicionar aviso na página de detalhamento
2. `src/components/pdf/FirewallPDF.tsx` - Adicionar aviso para manter consistência

