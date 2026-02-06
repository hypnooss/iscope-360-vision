

# Plano: Quantidade Dinâmica de Eventos de Login Baseada em Usuários Ativos

## Problema Atual

O valor fixo de **500 eventos** não é representativo:
- **Ambiente pequeno** (50 usuários): 500 eventos pode cobrir ~1 semana
- **Ambiente grande** (1000+ usuários): 500 eventos pode cobrir apenas ~2 horas

## Solução Proposta

Calcular dinamicamente a quantidade de eventos baseado no número de **usuários ativos**, com limites mínimo e máximo para garantir performance e representatividade.

### Fórmula

```
eventos = min(max(activeUsers × 3, 500), 5000)
```

| Usuários Ativos | Fórmula (×3) | Valor Final |
|-----------------|--------------|-------------|
| 50              | 150          | **500** (mínimo) |
| 200             | 600          | **600** |
| 500             | 1500         | **1500** |
| 1000            | 3000         | **3000** |
| 2000            | 6000         | **5000** (máximo) |

### Limites
- **Mínimo: 500** - Garante amostra significativa mesmo em ambientes pequenos
- **Máximo: 5000** - Evita timeout/problemas de performance na API do Graph

---

## Alteração no Código

**Arquivo:** `supabase/functions/m365-security-posture/index.ts`

### Antes (linha 205)
```typescript
'/auditLogs/signIns?$select=location,status&$top=500',
```

### Depois
```typescript
// Calculate dynamic sample size based on active users (min 500, max 5000)
const signInSampleSize = Math.min(Math.max(metrics.activeUsers * 3, 500), 5000);
console.log(`[collectEnvironmentMetrics] Sign-in sample size: ${signInSampleSize} (based on ${metrics.activeUsers} active users)`);

const { data: signIns } = await graphFetchSafe(
  accessToken,
  `/auditLogs/signIns?$select=location,status&$top=${signInSampleSize}`,
  { beta: true }
);
```

---

## Vantagens

1. **Proporcionalidade**: Ambientes maiores terão amostra maior automaticamente
2. **Performance segura**: Limite de 5000 evita problemas com a API
3. **Retrocompatibilidade**: Nenhuma mudança no formato dos dados
4. **Transparência**: Log indica quantos eventos foram solicitados e por quê

---

## Resumo

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Calcular `$top` dinamicamente baseado em `activeUsers × 3` |

---

## Consideração sobre Multiplicador

O multiplicador **×3** foi escolhido considerando:
- Usuário médio faz 2-4 autenticações/dia (app, web, mobile, etc.)
- Representa aproximadamente 1 dia de atividade em condições normais
- Para análises de maior período, pode-se aumentar para **×5** ou **×7**

Se preferir um período maior de cobertura, posso ajustar o multiplicador.

