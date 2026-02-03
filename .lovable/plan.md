
## Ajustar Cores dos Ícones de Status nas Categorias

### Problema Identificado

Os ícones de check e fail nos itens das categorias (print 2) usam tonalidades diferentes das usadas nos cards de informação (print 1):

| Elemento | Cor Atual | Cor Esperada |
|----------|-----------|--------------|
| Check (pass) | Verde esmeralda (`success`: HSL 142 76% 36%) | Teal/Primary (`text-primary`: HSL 175 80% 45%) |
| Fail | Vermelho (`destructive`: HSL 0 72% 51%) | Rosa (`text-rose-400`: rose-400) |

### Análise

Os cards MiniStat usam:
- **Aprovadas (success)**: `text-primary` + `border-primary/30` + `bg-primary/10`
- **Falhas (destructive)**: `text-rose-400` + `border-rose-500/30` + `bg-rose-500/10`

Enquanto as classes de status dos ComplianceCard usam:
- **status-pass**: `text-success` + `bg-success/10` + `border-success/30`
- **status-fail**: `text-destructive` + `bg-destructive/10` + `border-destructive/30`

---

### Solução

Atualizar as classes `status-pass` e `status-fail` no arquivo `src/index.css` para usar as mesmas cores dos cards de estatística.

---

### Alterações Técnicas

**Arquivo:** `src/index.css`

**Código atual (linhas 98-104):**
```css
.status-pass {
  @apply text-success bg-success/10 border-success/30;
}

.status-fail {
  @apply text-destructive bg-destructive/10 border-destructive/30;
}
```

**Novo código:**
```css
.status-pass {
  @apply text-primary bg-primary/10 border-primary/30;
}

.status-fail {
  @apply text-rose-400 bg-rose-500/10 border-rose-500/30;
}
```

---

### Resultado Visual

| Estado | Antes | Depois |
|--------|-------|--------|
| Pass | Verde esmeralda | Teal (igual ao card "21 APROVADAS") |
| Fail | Vermelho | Rosa (igual ao card "2 FALHAS") |

---

### Arquivo Modificado

- `src/index.css`
