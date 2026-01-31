
# Plano: Atualização do MiniStat TOTAL + Adição de SPF/DKIM/DMARC

## Alterações Solicitadas

1. **MiniStat "TOTAL"**: Usar cor verde-água (primary) em vez de neutro
2. **Remover**: DetailRow "Workspace"
3. **Adicionar**: DetailRows para SPF, DKIM e DMARC com status

---

## Implementação

### 1. Adicionar variante "primary" ao MiniStat

No objeto `variantStyles`, adicionar:

```tsx
primary: {
  text: "text-primary",           // verde-água
  border: "border-primary/30",
  bg: "bg-primary/10"
}
```

E alterar a chamada do MiniStat de TOTAL:
```tsx
<MiniStat value={stats.total} label="Total" variant="primary" />
```

### 2. Atualizar mockData com status de email

Adicionar ao `mockData`:
```tsx
emailAuth: {
  spf: true,    // ou "valid" / "invalid"
  dkim: true,
  dmarc: false,
}
```

### 3. Substituir Workspace por SPF/DKIM/DMARC

No painel de detalhes, remover:
```tsx
<DetailRow label="Workspace" value={clientName} highlight />
```

E adicionar:
```tsx
<DetailRow 
  label="SPF" 
  value={emailAuth.spf ? "Válido" : "Ausente"} 
  indicator={emailAuth.spf ? "success" : "error"}
/>
<DetailRow 
  label="DKIM" 
  value={emailAuth.dkim ? "Válido" : "Ausente"} 
  indicator={emailAuth.dkim ? "success" : "error"}
/>
<DetailRow 
  label="DMARC" 
  value={emailAuth.dmarc ? "Válido" : "Ausente"} 
  indicator={emailAuth.dmarc ? "success" : "error"}
/>
```

---

## Resultado Visual Esperado

| Elemento | Antes | Depois |
|----------|-------|--------|
| **MiniStat Total** | Neutro (cinza) | Verde-água (primary) com borda e bg coloridos |
| **Workspace** | Presente | Removido |
| **SPF/DKIM/DMARC** | Ausentes | Exibidos com indicadores ●/● de status |

---

## Arquivo a Modificar

`src/pages/preview/DomainReportPreview.tsx`

- Linha 24-27: Adicionar "primary" à interface MiniStatProps
- Linha 31-35: Adicionar variante "primary" ao variantStyles
- Linha 5-18: Adicionar emailAuth ao mockData
- Linha 193: Alterar variant para "primary"
- Linha 209: Substituir Workspace por SPF/DKIM/DMARC rows
