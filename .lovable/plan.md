
# Plano: Ajustes nas Evidências de Regras de Entrada

## Alterações Solicitadas

1. **Renomear label** de "Interfaces WAN" para "Interfaces analisadas" nas evidências
2. **Ocultar JSON bruto** quando não houver regras vulneráveis
3. **Exibir ID e Nome** das regras vulneráveis encontradas (já implementado, apenas confirmar)

---

## Arquivo: `supabase/functions/agent-task-result/index.ts`

### Mudança 1: Renomear label nas evidências (linha 887)

```typescript
// ANTES
evidence.push({
  label: 'Interfaces WAN',
  value: wanInterfaces.join(', '),
  type: 'code'
});

// DEPOIS
evidence.push({
  label: 'Interfaces analisadas',
  value: wanInterfaces.join(', '),
  type: 'code'
});
```

### Mudança 2: Só incluir rawData quando houver regras vulneráveis (linhas 1053-1070)

```typescript
// ANTES
} else if (rule.code.startsWith('inb-') && inboundResult) {
  // Para regras de inbound, sempre incluir informações (mesmo se vazio)
  checkRawData = {
    policies_vulneraveis: inboundResult.relevantPolicies.map(p => ({...})),
    total_policies_analisadas: ...,
    interfaces_wan_detectadas: ...
  };
}

// DEPOIS
} else if (rule.code.startsWith('inb-') && inboundResult && inboundResult.relevantPolicies.length > 0) {
  // Para regras de inbound, só incluir dados quando há regras vulneráveis
  checkRawData = {
    policies_vulneraveis: inboundResult.relevantPolicies.map(p => ({
      policyid: p.policyid,
      name: p.name,
      srcintf: p.srcintf,
      dstintf: p.dstintf,
      srcaddr: p.srcaddr,
      dstaddr: p.dstaddr,
      service: p.service,
      action: p.action,
      status: p.status
    }))
  };
}
```

### Mudança 3: Atualizar referência ao label (linha 1069)

Esta mudança não é mais necessária pois a lógica muda - não precisamos mais buscar a interface pelo label na geração do rawData.

---

## Resumo das Alterações

| Local | Alteração |
|-------|-----------|
| Linha 887 | Renomear `'Interfaces WAN'` → `'Interfaces analisadas'` |
| Linha 1053 | Adicionar condição `&& inboundResult.relevantPolicies.length > 0` |
| Linhas 1054-1070 | Simplificar `checkRawData` para só incluir `policies_vulneraveis` |

---

## Resultado Esperado

### Quando NÃO há regras vulneráveis:
- ✅ Status: "Nenhuma regra vulnerável encontrada"
- ✅ Interfaces analisadas: `wan, lan2, virtual-wan-link`
- ❌ **Sem JSON bruto** (oculto)

### Quando HÁ regras vulneráveis:
- ❌ Status: "X regra(s) vulnerável(is) encontrada(s)"
- ✅ Regra 123: `🟢 Nome da Regra`
- ✅ Origem, Destino, Serviço, Ação detalhados
- ✅ Interfaces analisadas: `wan, lan2, virtual-wan-link`
- ✅ **JSON bruto** com as políticas vulneráveis (ID, Nome, etc)

---

## Validação

1. Execute nova análise do firewall
2. Verifique regras de RDP, Entrada sem Restrição, SMB/CIFS:
   - Label agora mostra "Interfaces analisadas" 
   - Sem JSON bruto quando status é "pass"
   - Com JSON bruto (apenas políticas vulneráveis) quando status é "fail"
