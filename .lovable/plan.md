
# Plano: Renomear Sistema para "iScope 360" e Atualizar Logo

## Resumo

Alterar o nome do sistema de **InfraScope 360** para **iScope 360** em todos os lugares do código, e substituir o logo atual (Precisio Analytics) pelo novo logo enviado.

---

## Arquivos a Modificar

### 1. Copiar o Novo Logo

**Ação**: Copiar a imagem enviada para o projeto

```
user-uploads://image-12.png → src/assets/logo-iscope.png
```

---

### 2. Atualização do Nome e Logo por Arquivo

| Arquivo | Alterações |
|---------|------------|
| `index.html` | Linha 7: `<title>iScope 360</title>` |
| `src/components/Header.tsx` | Linha 4: import do novo logo<br>Linha 13: alt do logo<br>Linha 14: texto "iScope 360" |
| `src/components/layout/AppLayout.tsx` | Linha 40: import do novo logo<br>Linhas 371, 372, 400, 401, 420, 421: alt e textos |
| `src/pages/Auth.tsx` | Linha 9: import do novo logo<br>Linha 416: alt do logo<br>Linha 417: texto "iScope 360" |
| `src/pages/ModuleSelectionPage.tsx` | Linha 7: import do novo logo<br>Linha 93: alt do logo<br>Linha 94: texto "iScope 360" |
| `src/components/m365/TenantConnectionWizard.tsx` | Linhas 191, 354, 417: textos "iScope 360" |

---

## Detalhes Técnicos

### Substituição do Import do Logo

**De:**
```typescript
import logoPrecisio from '@/assets/logo-precisio-analytics.png';
```

**Para:**
```typescript
import logoIscope from '@/assets/logo-iscope.png';
```

### Substituição do Nome

**De:** `InfraScope 360`
**Para:** `iScope 360`

### Substituição do Alt Text

**De:** `alt="Precisio Analytics"`
**Para:** `alt="iScope 360"` (ou `alt="Precisio"` se preferir manter referência à empresa)

---

## Impacto

- **Visual**: Logo e nome atualizados em todas as páginas (landing, login, dashboard, sidebar, módulos)
- **SEO**: Título da aba do navegador atualizado
- **Consistência**: Todas as referências textuais ao nome do sistema serão atualizadas

---

## Arquivos que NÃO Precisam Alteração

- `public/favicon.png` - Manter o favicon atual (a menos que você queira alterá-lo também)
- Metadados Open Graph em `index.html` - Já estavam com valores placeholder
