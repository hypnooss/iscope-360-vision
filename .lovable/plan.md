
# Ajustes na Pagina de Fontes de CVE

## 1. Botao de Voltar

Adicionar um botao com icone `ArrowLeft` antes do titulo "Fontes de CVE", seguindo o mesmo padrao da pagina de Editar Firewall. O botao navega de volta para `/cves`.

## 2. Cor de fundo nos cards de fonte

Os cards de cada fonte (`SourceCard`) atualmente usam apenas `border rounded-lg`. Vou adicionar a classe `glass-card` e uma cor de fundo sutil baseada no modulo, similar ao estilo dos StatCards -- usando as cores do modulo (laranja para Firewall, azul para M365, verde para Dominio Externo).

## 3. Nova fonte: history (Dominio Externo)

Inserir uma nova entrada na tabela `cve_sources` para a biblioteca `history` (v4.7.2), usada pelo React Router. Como e uma biblioteca JavaScript/npm, sera configurada com `source_type = 'nist_nvd_web'` e `product_filter = 'history'`.

## Detalhes Tecnicos

### Arquivo: `src/pages/admin/CVESourcesPage.tsx`

**Botao de voltar** - Adicionar import de `ArrowLeft` e `useNavigate`, e inserir o botao antes do titulo:

```typescript
import { useNavigate } from 'react-router-dom';
// No componente:
const navigate = useNavigate();
// No JSX, antes do titulo:
<Button variant="ghost" size="icon" onClick={() => navigate('/cves')}>
  <ArrowLeft className="w-5 h-5" />
</Button>
```

**Cor de fundo nos cards** - Adicionar mapa de cores de fundo por modulo e aplicar no SourceCard:

```typescript
const MODULE_BG: Record<string, string> = {
  firewall: 'bg-orange-500/5 border-orange-500/20',
  m365: 'bg-blue-500/5 border-blue-500/20',
  external_domain: 'bg-emerald-500/5 border-emerald-500/20',
};

// No SourceCard div:
<div className={cn("border rounded-lg p-4 space-y-3", MODULE_BG[source.module_code] || '')}>
```

### Migracao SQL

Inserir nova fonte para a biblioteca `history`:

```sql
INSERT INTO cve_sources (module_code, source_type, source_label, config, is_active)
VALUES ('external_domain', 'nist_nvd_web', 'History', '{"product_filter": "history"}', true);
```

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/admin/CVESourcesPage.tsx` | Botao voltar + cor de fundo nos cards |
| Migracao SQL | Nova fonte "History" |
