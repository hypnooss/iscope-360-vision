

# Plano: Divisão do Card "Tráfego Negado" em Entrada/Saída com Sheet Padronizado

## Contexto
O card "Tráfego Negado" atual mostra apenas dados de bloqueio. O usuário quer:
1. **Dois cards separados**: Tráfego de Entrada e Tráfego de Saída
2. **Barra proporcional**: mostrar permitido vs negado em cada card
3. **Sheet lateral padronizado**: 50vw com abas inline (padrão M365/Surface Analyzer)

## Análise de Dados Disponíveis

O `AnalyzerSnapshot.metrics` já contém os dados necessários:

**Entrada (Inbound):**
- `inboundBlocked`: número de eventos bloqueados
- `inboundAllowed`: número de eventos permitidos
- `topInboundBlockedIPs`, `topInboundBlockedCountries`
- `topInboundAllowedIPs`, `topInboundAllowedCountries`

**Saída (Outbound):**
- `outboundBlocked`: número de eventos bloqueados
- `outboundConnections`: número de eventos permitidos
- `topOutboundBlockedIPs`, `topOutboundBlockedCountries`
- `topOutboundIPs`, `topOutboundCountries`

## Mudanças Necessárias

### 1. Adicionar Novas Categorias (`types/analyzerInsights.ts`)

Substituir categoria `denied_traffic` por duas novas:
- `inbound_traffic` (entrada)
- `outbound_traffic` (saída)

Atualizar `ANALYZER_CATEGORY_INFO` com:
```typescript
inbound_traffic: {
  label: 'Tráfego de Entrada',
  icon: 'arrow-down-to-line',
  colorHex: '#ef4444',
  description: 'Tráfego externo tentando acessar o firewall'
}
outbound_traffic: {
  label: 'Tráfego de Saída',
  icon: 'arrow-up-from-line', 
  colorHex: '#f97316',
  description: 'Tráfego interno acessando recursos externos'
}
```

### 2. Atualizar Grid de Categorias (`AnalyzerCategoryGrid.tsx`)

**Substituir `denied_traffic` por duas categorias no array `CATEGORY_ORDER`:**
```typescript
const CATEGORY_ORDER = [
  'inbound_traffic',   // Novo
  'outbound_traffic',  // Novo
  'fw_authentication',
  // ... resto
];
```

**Adicionar lógica `getCategoryStats` para as duas categorias:**

```typescript
case 'inbound_traffic':
  const inDenied = metrics.inboundBlocked || 0;
  const inAllowed = metrics.inboundAllowed || 0;
  const inTotal = inDenied + inAllowed;
  return {
    total: inTotal,
    denied: inDenied,
    allowed: inAllowed,
    severity: inDenied > 1000 ? 'critical' : inDenied > 500 ? 'high' : ...
  };

case 'outbound_traffic':
  const outDenied = metrics.outboundBlocked || 0;
  const outAllowed = metrics.outboundConnections || 0;
  const outTotal = outDenied + outAllowed;
  return {
    total: outTotal,
    denied: outDenied,
    allowed: outAllowed,
    severity: outDenied > 500 ? 'high' : outDenied > 100 ? 'medium' : ...
  };
```

**Atualizar renderização da barra:**

Quando `stats.denied` e `stats.allowed` existem, dividir a barra em duas partes proporcionais:
```tsx
<div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden flex">
  <div 
    className="h-full bg-red-500" 
    style={{ width: `${(stats.denied / stats.total) * 100}%` }}
  />
  <div 
    className="h-full bg-green-500" 
    style={{ width: `${(stats.allowed / stats.total) * 100}%` }}
  />
</div>
```

**Atualizar badges:**
```tsx
{stats.denied > 0 && (
  <Badge>🔴 {stats.denied} Negado</Badge>
)}
{stats.allowed > 0 && (
  <Badge>🟢 {stats.allowed} Permitido</Badge>
)}
```

### 3. Atualizar Sheet (`AnalyzerCategorySheet.tsx`)

**Mudança 1: Aumentar largura para 50vw**
```tsx
<SheetContent side="right" className="w-full sm:max-w-[50vw] p-0">
```

**Mudança 2: Adicionar Abas Inline**

Importar `Tabs`:
```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
```

Estrutura das abas (padrão M365):
```tsx
<Tabs defaultValue="entrada" className="flex flex-col h-full">
  <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-6 h-auto py-0">
    <TabsTrigger 
      value="entrada" 
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs"
    >
      <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
      Tráfego de Entrada
    </TabsTrigger>
    <TabsTrigger 
      value="saida"
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs"
    >
      <ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5" />
      Tráfego de Saída
    </TabsTrigger>
  </TabsList>

  <TabsContent value="entrada" className="flex-1">
    <ScrollArea className="h-full">
      {/* Conteúdo de entrada */}
    </ScrollArea>
  </TabsContent>

  <TabsContent value="saida" className="flex-1">
    <ScrollArea className="h-full">
      {/* Conteúdo de saída */}
    </ScrollArea>
  </TabsContent>
</Tabs>
```

**Mudança 3: Renderizar conteúdo por categoria**

Para `inbound_traffic` e `outbound_traffic`, renderizar **dentro das abas**:

```tsx
case 'inbound_traffic':
case 'outbound_traffic':
  return (
    <Tabs defaultValue="entrada">
      <TabsList>{/* ... abas */}</TabsList>
      
      <TabsContent value="entrada">
        <div className="p-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top IPs Bloqueados (Entrada)</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.topInboundBlockedIPs?.map(...)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top IPs Permitidos (Entrada)</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.topInboundAllowedIPs?.map(...)}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="saida">
        <div className="p-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top IPs Bloqueados (Saída)</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.topOutboundBlockedIPs?.map(...)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top IPs Permitidos (Saída)</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.topOutboundIPs?.map(...)}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
```

### 4. Remover Categoria Antiga

Remover o case `denied_traffic` de `AnalyzerCategorySheet.tsx`

## Arquivos Modificados

1. **`src/types/analyzerInsights.ts`**
   - Adicionar `inbound_traffic` e `outbound_traffic` ao tipo `AnalyzerEventCategory`
   - Atualizar `ANALYZER_CATEGORY_INFO`

2. **`src/components/firewall/AnalyzerCategoryGrid.tsx`**
   - Atualizar `CATEGORY_ORDER`
   - Adicionar lógica `getCategoryStats` para as duas categorias
   - Renderizar barra bicolor (denied/allowed)
   - Atualizar badges

3. **`src/components/firewall/AnalyzerCategorySheet.tsx`**
   - Mudar largura para `sm:max-w-[50vw]`
   - Adicionar abas inline (padrão M365)
   - Implementar conteúdo separado por aba
   - Remover case `denied_traffic`

## Benefícios

- **Clareza**: Separa entrada vs saída, facilitando análise de ataques externos vs políticas de egress
- **Contexto**: Mostra proporção permitido/negado, revelando se firewall está muito restritivo
- **Consistência**: Sheet padronizado com 50vw e abas inline (padrão do sistema)
- **Escalabilidade**: Estrutura de abas permite adicionar dados futuros (ex: "Por Porta", "Por País")

