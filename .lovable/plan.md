
# Adicionar Instrução de Trusted Hosts — Hardening do REST API Admin

## Contexto de Segurança

O campo **Trusted Hosts** visível na tela de configuração do FortiGate permite restringir de quais endereços IP o token da REST API pode ser usado. Sem isso, qualquer pessoa que obtiver o API Token pode consultar a API do FortiGate de qualquer lugar da internet.

Para um software de compliance e segurança, omitir essa instrução seria uma falha grave. O cliente precisa ser orientado a:
1. Habilitar o toggle **Trusted Hosts** no formulário do REST API Admin
2. Cadastrar o IP do host onde o agente iScope está instalado como único host autorizado

## Mudanças no arquivo `src/pages/environment/AddFirewallPage.tsx`

### 1. Adicionar sub-item ao passo "c" (formulário do REST API Admin) — linhas 162–180

Dentro da lista de campos do formulário (sub-itens do passo c), adicionar dois novos itens antes do "Clique em OK":

```
– Trusted Hosts: ative o toggle
– Trusted Hosts → Host 1: insira o IP do servidor do agente iScope (ex: 192.168.1.50/32)
```

Isso garante que o usuário configure o campo enquanto ainda está no formulário, antes de clicar em OK.

### 2. Atualizar o snippet CLI do Passo 2 — linha 196

Adicionar a linha `set trusthost1 <IP-do-agente>/32` ao snippet, para que administradores que preferirem configurar via CLI também saibam o comando correto:

```
config system api-user
    edit "iscope360"
        set accprofile "super_admin_readonly"
        set vdom "root"
        set trusthost1 <IP-do-agente>/32
    next
end
```

### 3. Adicionar bloco de aviso de segurança dedicado (após os passos e antes da nota sobre SSL)

Um bloco novo com bordas vermelhas/amber sinalizando que Trusted Hosts é **obrigatório por boas práticas**, explicando o risco de não configurá-lo:

```
🔒 Segurança: Restrição por IP (Trusted Hosts)

Habilitar Trusted Hosts é essencial. Sem essa restrição, o API Token 
pode ser usado de qualquer origem na internet caso seja comprometido.

Ao ativar Trusted Hosts, somente requisições originadas do IP do agente 
iScope serão aceitas pelo FortiGate — o token se torna inútil fora desse contexto.
```

## Estrutura final do Passo 1 (formulário)

```
a – Vá em System > Administrators
b – Clique em Create New > REST API Admin
c – Preencha o formulário:
      – Username: iscope360
      – Administrator Profile: super_admin_readonly
      – PKI Group: desmarque (deixe desabilitado)
      – Trusted Hosts: ative o toggle         ← NOVO
      – Host 1: IP do agente iScope/32        ← NOVO
      – Clique em OK
d – Anote o API Token gerado
```

## Arquivo modificado

- `src/pages/environment/AddFirewallPage.tsx` — função `FortiGateInstructions`:
  - Sub-lista do passo `c` (linhas 162–180): adicionar itens Trusted Hosts
  - Snippet CLI do Passo 2 (linha 196): adicionar `set trusthost1`
  - Novo bloco de aviso de segurança entre o bloco de passos e a nota de SSL
