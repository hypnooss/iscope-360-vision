

## Ajustar abas do MFA para seguir o padrão visual do sistema

### Problema
As abas da janela MFA estão usando o estilo "pill/filled" padrão do Radix (`grid w-full grid-cols-3` com background), enquanto o padrão do sistema (usado no Exchange Analyzer) é de abas com underline (`border-b-2`, fundo transparente).

### Alteração
**Arquivo:** `src/components/m365/entra-id/EntraIdCategorySheet.tsx` (linhas 154-160)

Substituir o `Tabs` + `TabsList` atual por o mesmo padrão usado no `ExchangeCategorySheet`:

```tsx
<Tabs defaultValue="overview" className="space-y-4">
  <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-0 h-auto py-0">
    <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs">
      Status Geral
    </TabsTrigger>
    <TabsTrigger value="enabled" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs">
      MFA Habilitado ({enabledUsers.length})
    </TabsTrigger>
    <TabsTrigger value="disabled" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs">
      MFA Desativado ({disabledUsersDetail.length})
    </TabsTrigger>
  </TabsList>
```

Isso alinha com o padrão de underline tabs usado nos sheets de Anti-Spam, Phishing e demais categorias do Exchange.

