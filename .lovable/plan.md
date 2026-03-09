

# Adicionar cards de Postura de Segurança e Tráfego de Email

## O que fazer

Inserir os dois cards existentes (`EmailSecurityPostureCard` e `EmailTrafficCard`) entre o Panorama por Categoria e os Insights de Segurança na página Exchange Analyzer.

## Alteração

### `src/pages/m365/ExchangeAnalyzerPage.tsx`

1. Importar `EmailSecurityPostureCard` e `EmailTrafficCard`
2. Entre a seção `{/* Category Grid */}` e `{/* Security Insights */}`, adicionar um grid 2 colunas com os dois cards:

```tsx
{selectedTenantId && !loading && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <EmailSecurityPostureCard data={effectiveDashboard} />
    <EmailTrafficCard data={effectiveDashboard} />
  </div>
)}
```

Apenas 1 arquivo modificado, ~5 linhas adicionadas.

