

# Correção das Abas no Sheet de Tráfego

## Problema
As abas atuais no sheet são "Tráfego de Entrada" e "Tráfego de Saída", mas o correto é que cada sheet (Entrada ou Saída) tenha suas próprias abas **"Permitido"** e **"Bloqueado"**. Também falta a linha horizontal (`border-b`) acima das abas, padrão do Surface Analyzer.

## Mudança em `AnalyzerCategorySheet.tsx`

Substituir `renderTrafficContent()` que hoje usa abas Entrada/Saída por uma lógica condicional baseada na categoria clicada:

- **Se `inbound_traffic`**: Header mostra "Tráfego de Entrada", abas são "Permitido" / "Bloqueado"
  - Aba Permitido: `topInboundAllowedIPs`, `topInboundAllowedCountries`
  - Aba Bloqueado: `topInboundBlockedIPs`, `topInboundBlockedCountries`

- **Se `outbound_traffic`**: Header mostra "Tráfego de Saída", abas são "Permitido" / "Bloqueado"
  - Aba Permitido: `topOutboundIPs`, `topOutboundCountries`
  - Aba Bloqueado: `topOutboundBlockedIPs`, `topOutboundBlockedCountries`

### Estrutura do Header (padrão Surface Analyzer)
```tsx
<SheetHeader className="px-6 pt-6 pb-4 space-y-3">
  {/* icon + title + description */}
</SheetHeader>
{/* Separator line before tabs */}
<Separator />
<Tabs defaultValue="bloqueado" className="flex flex-col flex-1 min-h-0">
  <TabsList className="...border-b styling...">
    <TabsTrigger value="bloqueado">
      <ShieldX /> Bloqueado
    </TabsTrigger>
    <TabsTrigger value="permitido">
      <ShieldCheck /> Permitido
    </TabsTrigger>
  </TabsList>
  <TabsContent value="bloqueado">
    {/* Top IPs Bloqueados + Top Países Bloqueados */}
  </TabsContent>
  <TabsContent value="permitido">
    {/* Top IPs Permitidos + Top Países Permitidos */}
  </TabsContent>
</Tabs>
```

### Dados por aba

| Categoria | Aba Bloqueado | Aba Permitido |
|-----------|--------------|---------------|
| `inbound_traffic` | `topInboundBlockedIPs`, `topInboundBlockedCountries`, badge com `inboundBlocked` | `topInboundAllowedIPs`, `topInboundAllowedCountries`, badge com `inboundAllowed` |
| `outbound_traffic` | `topOutboundBlockedIPs`, `topOutboundBlockedCountries`, badge com `outboundBlocked` | `topOutboundIPs`, `topOutboundCountries`, badge com `outboundConnections` |

## Arquivo modificado
- `src/components/firewall/AnalyzerCategorySheet.tsx` -- reescrever `renderTrafficContent()`, adicionar `Separator` antes das abas

