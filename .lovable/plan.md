
# Alinhamento de colunas — todas as tabelas com Frequência

## Problema

Cada `AssetCategorySection` é uma tabela HTML independente. Como Domínios Externos e Firewalls têm 7 colunas (com Frequência) e M365 tem 6 (sem Frequência), as colunas ficam visivelmente desalinhadas entre as seções.

## Solução

Remover a lógica condicional `showFrequency` e tornar a coluna **Frequência fixa em todas as tabelas**, com o mesmo conjunto de colunas:

```
Nome | Agent | Workspace | Frequência | Score | Status | Ações
```

Para Tenants M365, que não possuem agenda configurável, a célula exibe `—` (traço).

---

## Mudanças técnicas

### `src/components/environment/AssetCategorySection.tsx`

**a) Remover a prop `showFrequency`** de `AssetCategorySectionProps`:
```ts
// REMOVER:
showFrequency?: boolean;
```

**b) A coluna Frequência passa a ser sempre renderizada** — sem `{showFrequency && ...}`:
```tsx
<TableHead>Frequência</TableHead>
```

**c) Na célula da linha**, exibir os badges quando há schedule, ou `—` quando não há:
```tsx
<TableCell>
  {asset.scheduleFrequency ? (
    <div className="flex flex-row flex-wrap items-center gap-1">
      <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES[freq]}`}>
        {FREQUENCY_LABELS[freq] || freq}
      </Badge>
      {freq === 'daily' && (
        <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES.daily}`}>
          {String(asset.scheduleHour ?? 0).padStart(2, '0')}:00
        </Badge>
      )}
      {freq === 'weekly' && (
        <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES.weekly}`}>
          {DAYS_OF_WEEK_SHORT[asset.scheduleDayOfWeek ?? 1]} · {String(asset.scheduleHour ?? 0).padStart(2, '0')}:00
        </Badge>
      )}
      {freq === 'monthly' && (
        <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES.monthly}`}>
          Dia {asset.scheduleDayOfMonth ?? 1} · {String(asset.scheduleHour ?? 0).padStart(2, '0')}:00
        </Badge>
      )}
    </div>
  ) : (
    <span className="text-muted-foreground text-sm">—</span>
  )}
</TableCell>
```

### `src/pages/EnvironmentPage.tsx`

Remover a prop `showFrequency` das chamadas `<AssetCategorySection>` (Domínios Externos e Firewalls), já que não é mais necessária.

---

## Resultado visual esperado

Todas as três tabelas terão as mesmas 7 colunas, alinhadas:

| Nome | Agent | Workspace | Frequência | Score | Status | Ações |
|---|---|---|---|---|---|---|
| estrela.com.br | ESTRELA-SAO | ... | 🔵 Diário `20:00` | 89% | Analisado | ✏️ 🗑️ |
| SONICWALL | ESTRELA-SAO | ... | ⬜ Manual | 59% | Analisado | ✏️ 🗑️ |
| ESTRELA (M365) | ESTRELA-ITP | ... | — | — | Parcial | Abrir |

## Arquivos modificados

- `src/components/environment/AssetCategorySection.tsx`
- `src/pages/EnvironmentPage.tsx`
