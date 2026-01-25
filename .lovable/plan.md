
# Correção do Nome do Firewall no Alerta

## Problema Identificado

O alerta de "Análise Concluída" mostra o nome genérico "Firewall" ao invés do nome real do dispositivo (ex: "SAO-FW"). 

**Causa raiz:** A query nas linhas 733-737 está falhando silenciosamente, fazendo o fallback para o valor default `'Firewall'`.

## Solução

Modificar a query existente na linha 644-648 para incluir o campo `name` junto com `device_type_id`, eliminando a necessidade da segunda query e garantindo que o nome esteja disponível.

## Alterações no Edge Function

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

### 1. Modificar a query inicial para incluir o nome (linha 645)

```typescript
// ANTES (linha 645)
.select('device_type_id')

// DEPOIS
.select('device_type_id, name')
```

### 2. Usar o nome do firewall já disponível (linhas 732-739)

```typescript
// ANTES (linhas 732-739)
// Get firewall name for the alert
const { data: firewallData } = await supabase
  .from('firewalls')
  .select('name')
  .eq('id', task.target_id)
  .single();

const firewallName = firewallData?.name || 'Firewall';

// DEPOIS
// Use firewall name from earlier query (already fetched at line 644)
const firewallName = firewall?.name || 'Dispositivo';
```

### 3. Adicionar log para debug

Adicionar um log antes de criar o alerta para facilitar diagnóstico futuro:

```typescript
console.log(`Creating analysis alert for firewall: ${firewallName} (id: ${task.target_id})`);
```

## Benefícios

1. **Corrige o bug**: O nome correto do firewall será exibido no alerta
2. **Melhora performance**: Remove uma query desnecessária ao banco de dados  
3. **Facilita debug**: Adiciona log para rastrear problemas futuros

## Teste de Verificação

Após deploy, executar nova análise do SAO-FW e verificar:
- O alerta deve mostrar: `A análise do firewall "SAO-FW" foi concluída com score XX%.`
- O log deve mostrar: `Creating analysis alert for firewall: SAO-FW (id: 6033d9d9-...)`
