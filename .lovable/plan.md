

## Correção do label da badge "Agent" → "Domain Compliance"

**Arquivo**: `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`

Na linha 130-132, o `typeConfig.agent` tem label `'Agent'`. Alterar para `'Domain Compliance'` para manter consistência — a coluna "Agent" já identifica quem executa.

```typescript
agent: {
  label: 'Domain Compliance',
  color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
},
```

