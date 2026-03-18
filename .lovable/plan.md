
## Plano: Remover banner de problemas críticos

Remover o bloco de banner vermelho "X problemas críticos encontrados" da página `src/pages/external-domain/ExternalDomainCompliancePage.tsx` (linhas 729-742).

### Alteração

**Arquivo:** `src/pages/external-domain/ExternalDomainCompliancePage.tsx`

Deletar o bloco do critical banner (linhas 729-742):
```tsx
{/* Critical banner */}
{criticalOnlyCount > 0 && (
  <div className="glass-card rounded-xl p-4 mb-8 border-destructive/50 bg-destructive/5 animate-fade-in">
    ...
  </div>
)}
```

Também pode-se remover o `useMemo` de `criticalOnlyCount` (linhas 397-400) e o import de `XCircle` se não for usado em outro lugar do arquivo.
