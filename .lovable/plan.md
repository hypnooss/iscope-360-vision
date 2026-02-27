

## Plano: Reordenar seções na aba Análise

### Mudança

**`src/components/compliance/ComplianceDetailSheet.tsx`** — reordenar blocos dentro de `TabsContent value="analise"`:

Ordem atual: Descrição → Análise Efetuada → Recomendação → Risco Técnico → Impacto no Negócio

Nova ordem: **Descrição → Análise Efetuada → Impacto no Negócio → Risco Técnico → Recomendação**

### Confirmação sobre visibilidade das abas
- **Análise**: visível para todos ✓
- **Evidências**: visível para todos ✓
- **Dados**: visível apenas para `super_admin` e `super_suporte` ✓ (já implementado corretamente)

### Arquivo editado (1)
- `src/components/compliance/ComplianceDetailSheet.tsx`

