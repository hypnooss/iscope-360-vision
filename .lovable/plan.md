
# Renomear Tabelas e Adicionar Abas — Top IPs e Top Países

## O que precisa ser feito

Ambas as mudanças estão em `src/pages/firewall/AnalyzerDashboardPage.tsx`, nas linhas 795–833.

---

## Mudança 1: "Top Tráfego" → "Top IPs - Tráfego" (linha 800)

Apenas renomear o título do card. As abas "Saída Permitida" e "Saída Bloqueada" já existem e já estão populadas com `topOutboundIPs` e `topOutboundBlockedIPs`.

```tsx
// ANTES (linha 800):
Top Tráfego

// DEPOIS:
Top IPs - Tráfego
```

---

## Mudança 2: "Top Países (Tráfego Negado)" → "Top Países (Tráfego)" com 3 abas (linhas 821–833)

O card atual exibe apenas uma lista sem abas, usando `topCountries` (países com tráfego negado de entrada).

Será transformado em um card com **3 abas**:

- **Saída Permitida** — usa `m?.topOutboundCountries` (já coletado)
- **Saída Bloqueada** — usa `m?.topOutboundBlockedCountries` (já coletado e salvo após a correção da edge function)
- **Negado (Entrada)** — usa `m?.topCountries` (dados existentes — tráfego de entrada negado)

```tsx
// DEPOIS:
<Card className="glass-card">
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-base">
      <Globe className="w-4 h-4 text-primary" />
      Top Países (Tráfego)
    </CardTitle>
  </CardHeader>
  <CardContent>
    {isLoading ? <Skeletons /> : (
      <Tabs defaultValue="outbound_allowed">
        <TabsList className="mb-3">
          <TabsTrigger value="outbound_allowed">Saída Permitida</TabsTrigger>
          <TabsTrigger value="outbound_blocked">Saída Bloqueada</TabsTrigger>
          <TabsTrigger value="denied">Negado (Entrada)</TabsTrigger>
        </TabsList>
        <TabsContent value="outbound_allowed">
          <CountryListWidget countries={m?.topOutboundCountries ?? []} />
        </TabsContent>
        <TabsContent value="outbound_blocked">
          <CountryListWidget countries={m?.topOutboundBlockedCountries ?? []} />
        </TabsContent>
        <TabsContent value="denied">
          <CountryListWidget countries={m?.topCountries ?? []} />
        </TabsContent>
      </Tabs>
    )}
  </CardContent>
</Card>
```

O card "Top Países Destino (Saída)" em linha 923–935 que exibia apenas `topOutboundCountries` sozinho será **removido**, pois os dados agora estão na aba "Saída Permitida" do card acima, evitando duplicação.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Linha 800: renomear título; Linhas 821–833: adicionar abas ao card de países; Linhas 923–935: remover card duplicado "Top Países Destino (Saída)" |

Nenhuma mudança de edge function, banco de dados ou hook necessária — todos os dados já estão sendo coletados e disponibilizados.
