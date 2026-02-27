

## Plano: Ajustar largura e abas dos painéis laterais

### 3 mudanças

#### 1. `ComplianceDetailSheet.tsx` — largura 50vw + mesclar Risco na aba Análise
- Mudar `sm:max-w-[540px] lg:max-w-[600px]` → `sm:max-w-[50vw]`
- Remover aba "Risco" separada
- Mover seções "Risco Técnico" e "Impacto no Negócio" para dentro da `TabsContent value="analise"`, abaixo da recomendação
- Remover variável `hasRisk` e referências à tab "risco"

#### 2. `ComplianceDetailSheet.tsx` — formatar abas no estilo underline (print 2)
Já usa estilo underline com `border-b-2`. Manter, mas ajustar para ficar consistente com o novo padrão do AssetDetailSheet (item 3).

#### 3. `AssetDetailSheet.tsx` — formatar abas no estilo underline (print 2/3)
- Mudar `TabsList` de `className="mx-6 mb-0 w-fit"` (pill style) → estilo underline:
  ```
  className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-6 h-auto py-0"
  ```
- Cada `TabsTrigger` recebe:
  ```
  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-sm"
  ```
- Adicionar ícones nas abas (Search, Network, Bug, Lock) para consistência visual

### Arquivos editados (2)
- `src/components/compliance/ComplianceDetailSheet.tsx`
- `src/components/surface/AssetDetailSheet.tsx`

