

## Alterar Cores de TXT e Subdomínios

### Problema

Verde (emerald) em TXT e verde-água (teal) em Subdomínios estão muito próximos, e o teal conflita com a cor primária do tema (que também é teal).

### Cores Atuais

| Grupo | Ícone | Borda/Background |
|-------|-------|------------------|
| NS | `sky-400` | `sky-500` |
| MX | `violet-400` | `violet-500` |
| SOA | `amber-400` | `amber-500` |
| TXT | `emerald-400` | `emerald-500` |
| Subdomínios | `teal-400` | `teal-500` |

### Novas Cores

| Grupo | Ícone | Borda/Background | Justificativa |
|-------|-------|------------------|---------------|
| TXT | `pink-400` | `pink-500` | Rosa contrasta bem com as cores frias existentes |
| Subdomínios | `indigo-400` | `indigo-500` | Azul-índigo complementa sky sem repetir |

---

### Alterações Técnicas

**Arquivo:** `src/components/external-domain/DNSMapSection.tsx`

#### 1. TXT (linha 480-485)

**Antes:**
```tsx
<DNSGroup
  title="TXT"
  count={3}
  icon={<FileText className="w-4 h-4 text-emerald-400" />}
  color="border-emerald-500/30 bg-emerald-500/5"
```

**Depois:**
```tsx
<DNSGroup
  title="TXT"
  count={3}
  icon={<FileText className="w-4 h-4 text-pink-400" />}
  color="border-pink-500/30 bg-pink-500/5"
```

#### 2. Subdomínios (linha 584-589)

**Antes:**
```tsx
<DNSGroup
  title="Subdomínios"
  count={subdomainSummary?.total_found ?? 0}
  icon={<Globe className="w-4 h-4 text-teal-400" />}
  color="border-teal-500/30 bg-teal-500/5"
```

**Depois:**
```tsx
<DNSGroup
  title="Subdomínios"
  count={subdomainSummary?.total_found ?? 0}
  icon={<Globe className="w-4 h-4 text-indigo-400" />}
  color="border-indigo-500/30 bg-indigo-500/5"
```

---

### Paleta Final

| Grupo | Cor |
|-------|-----|
| NS | Sky (azul claro) |
| MX | Violet (roxo) |
| SOA | Amber (âmbar/laranja) |
| TXT | Pink (rosa) |
| Subdomínios | Indigo (azul-índigo) |

---

### Arquivo Modificado

- `src/components/external-domain/DNSMapSection.tsx`

