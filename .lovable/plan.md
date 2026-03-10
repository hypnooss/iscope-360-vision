

# Ajuste do texto e formato da data de última coleta

## Alteração em `ExchangeAnalyzerPage.tsx` (linhas 202-208)

Mudar:
- Texto "Última análise:" → "Última coleta"
- Formato da data de `"dd MMM yyyy 'às' HH:mm"` → `"dd/MM/yyyy, HH:mm"` para ficar `09/03/2026, 15:03`

```tsx
<Clock className="w-4 h-4 text-muted-foreground" />
<span className="text-sm text-muted-foreground">Última coleta</span>
<Badge variant="outline" className="text-xs">
  {format(new Date(analyzedAt), "dd/MM/yyyy, HH:mm", { locale: ptBR })}
</Badge>
```

### Arquivo alterado
- `src/pages/m365/ExchangeAnalyzerPage.tsx`

