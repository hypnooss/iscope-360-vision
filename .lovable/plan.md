

## Correção: Layout Quebrado de Subdomínios no PDF

### Problema Identificado

O `minPresenceAhead` do `@react-pdf/renderer` tem um bug conhecido (#2658) que faz com que não funcione corretamente em alguns cenários. O cabeçalho "Subdomínios" continua sendo renderizado sozinho no final da página.

---

### Solução

Usar uma abordagem diferente: **agrupar o cabeçalho junto com os primeiros itens de conteúdo** usando `wrap={false}`, garantindo que pelo menos o cabeçalho + alguns subdomínios fiquem juntos.

---

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/pdf/sections/PDFDNSMap.tsx` | Separar os primeiros subdomínios em um bloco "inicial" com `wrap={false}` |

---

### Estratégia

```text
┌────────────────────────────────────────────────────────────────┐
│                    BLOCO INICIAL (wrap={false})                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  HEADER: Subdomínios                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ Subdomínio 1            │  │ Subdomínio 2                │  │
│  ├─────────────────────────┤  ├─────────────────────────────┤  │
│  │ Subdomínio 3            │  │ Subdomínio 4                │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                │
│  Se não couber na página atual, TODO o bloco vai              │
│  para a próxima página                                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    RESTANTE (pode quebrar)                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ Subdomínio 5            │  │ Subdomínio 6                │  │
│  ├─────────────────────────┤  ├─────────────────────────────┤  │
│  │ ...                     │  │ ...                         │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

### Mudanças no Código

**Antes (linhas 426-458):**
```typescript
{/* Subdomínios Section - Header ensures content follows */}
<View style={styles.section}>
  <CategoryHeader title="Subdomínios" color={headerColors.subdomain} minPresenceAhead={100} />
  {activeSubdomains.length > 0 ? (
    <View style={styles.twoColumnContainer}>
      {/* ... all subdomains ... */}
    </View>
  ) : (
    <Text style={styles.emptyText}>...</Text>
  )}
</View>
```

**Depois:**
```typescript
{/* Subdomínios Section */}
<View style={styles.section}>
  {activeSubdomains.length > 0 ? (
    <>
      {/* Initial block: Header + first 4 subdomains - kept together */}
      <View wrap={false}>
        <CategoryHeader title="Subdomínios" color={headerColors.subdomain} />
        <View style={styles.twoColumnContainer}>
          <View style={[styles.column, styles.columnLeft]}>
            {activeSubdomains.slice(0, 4).filter((_, idx) => idx % 2 === 0).map((sub, idx) => (
              <ValueCard key={idx} primary={...} secondary={...} />
            ))}
          </View>
          <View style={styles.column}>
            {activeSubdomains.slice(0, 4).filter((_, idx) => idx % 2 === 1).map((sub, idx) => (
              <ValueCard key={idx} primary={...} secondary={...} />
            ))}
          </View>
        </View>
      </View>
      
      {/* Remaining subdomains - can break across pages */}
      {activeSubdomains.length > 4 && (
        <View style={styles.twoColumnContainer}>
          <View style={[styles.column, styles.columnLeft]}>
            {activeSubdomains.slice(4, 20).filter((_, idx) => idx % 2 === 0).map((sub, idx) => (
              <ValueCard key={idx} primary={...} secondary={...} />
            ))}
          </View>
          <View style={styles.column}>
            {activeSubdomains.slice(4, 20).filter((_, idx) => idx % 2 === 1).map((sub, idx) => (
              <ValueCard key={idx} primary={...} secondary={...} />
            ))}
          </View>
        </View>
      )}
    </>
  ) : (
    <View wrap={false}>
      <CategoryHeader title="Subdomínios" color={headerColors.subdomain} />
      <Text style={styles.emptyText}>Nenhum subdomínio ativo encontrado</Text>
    </View>
  )}
</View>
```

---

### Por que isso funciona?

1. **`wrap={false}` no bloco inicial**: Garante que o cabeçalho + primeiros 4 subdomínios nunca sejam separados
2. **Bloco pequeno o suficiente**: 4 subdomínios cabem facilmente em uma página, então nunca serão "empurrados" por falta de espaço total
3. **Restante pode quebrar**: Após os primeiros 4, o react-pdf pode quebrar normalmente entre páginas

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Reestruturar seção de subdomínios | 15min |
| Testar PDF visualmente | 10min |
| **Total** | **~25min** |

