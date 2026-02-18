
# Reordenar Steps do Wizard — Instruções antes de Configuração

## Problema

A sequência atual é:
1. Fabricante → 2. Configuração → 3. Instruções → 4. Agendamento

O usuário chega no step 2 e é solicitado a fornecer a API Key, mas ainda não sabe como gerá-la. As instruções de como fazer isso só aparecem no step 3.

## Solução

Inverter a ordem dos steps 2 e 3:
1. Fabricante → 2. Instruções → 3. Configuração → 4. Agendamento

Assim o fluxo fica: escolha o fabricante → veja como configurar o dispositivo e gerar as credenciais → insira as credenciais e dados do firewall → defina o agendamento.

## Mudanças no arquivo `src/pages/environment/AddFirewallPage.tsx`

### 1. Atualizar o array `STEPS` (linha 65)

```tsx
// Antes:
const STEPS = [
  { id: 1, label: 'Fabricante' },
  { id: 2, label: 'Configuração' },
  { id: 3, label: 'Instruções' },
  { id: 4, label: 'Agendamento' },
];

// Depois:
const STEPS = [
  { id: 1, label: 'Fabricante' },
  { id: 2, label: 'Instruções' },
  { id: 3, label: 'Configuração' },
  { id: 4, label: 'Agendamento' },
];
```

### 2. Trocar a ordem de renderização dos steps no JSX

No bloco de renderização condicional dos steps, trocar os blocos do step 2 e step 3:

- O que era renderizado quando `step === 2` (Configuração) passa a ser renderizado quando `step === 3`
- O que era renderizado quando `step === 3` (Instruções) passa a ser renderizado quando `step === 2`

### 3. Atualizar a lógica de `canAdvanceStep`

A validação `canAdvanceStep2` (que verifica nome, URL, credenciais e agent) atualmente guarda o step 2. Após a troca, ela precisa guardar o step 3 (novo step de Configuração).

- `canAdvanceStep2` → mover para proteger o novo step 3 (Configuração)
- O step 2 (Instruções) não tem validação — o usuário avança livremente após ler as instruções

### 4. Nenhuma mudança na lógica de submit ou dados

Os dados do formulário, a lógica de autenticação condicional, geolocalização e agendamento permanecem idênticos — apenas a ordem de exibição muda.

## Arquivo modificado

- `src/pages/environment/AddFirewallPage.tsx` — array `STEPS`, bloco de renderização condicional dos steps e referências a `canAdvanceStep2`/`canAdvanceStep3`
