
# Ajustar cor do "Valor atual" para o mesmo verde do badge "Configurada"

O badge "Configurada" usa `bg-green-600`. O texto "Valor atual" deve usar `text-green-600` para manter consistencia visual.

## Alteracao

**Arquivo:** `src/pages/admin/SettingsPage.tsx` (linha 478)

De:
```
text-xs font-mono text-emerald-400
```

Para:
```
text-xs font-mono text-green-600
```
