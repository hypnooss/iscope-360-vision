
# Atualizar Instruções FortiGate — Usar perfil super_admin_readonly nativo

## O que muda

As instruções do Step 2 (FortiGateInstructions) atualmente guiam o usuário a:
1. Criar um perfil de administrador Read-Only customizado (System > Admin Profiles)
2. Criar o REST API Admin associando esse perfil
3. Opcionalmente configurar via CLI

Com a mudança, o **Passo 1 (criar perfil)** é eliminado, pois o FortiGate já possui o perfil nativo `super_admin_readonly`. A instrução passa a ser:
1. Criar o REST API Admin diretamente, selecionando o perfil existente `super_admin_readonly`
2. Opcionalmente ajustar via CLI (já referenciando o nome correto do perfil)

## Mudanças no arquivo `src/pages/environment/AddFirewallPage.tsx`

### Função `FortiGateInstructions` (linhas 141–188)

**Passo 1 — Criar REST API Admin** (era passo 2, agora é passo 1):
- Instrução: Ir em `System > Administrators`, clicar em **Create New > REST API Admin**
- Selecionar o perfil existente **`super_admin_readonly`** (nativo do FortiGate, não é preciso criá-lo)
- Anotar o **API Token** gerado

**Passo 2 — Habilitar acesso via CLI** (era passo 3, agora é passo 2):
- Atualizar o snippet CLI para referenciar `"super_admin_readonly"` em vez de `"read-only"`:
```
config system api-user
    edit "<nome-do-api-user>"
        set accprofile "super_admin_readonly"
        set vdom "root"
    next
end
```

**Remover** o bloco antigo "Passo 1: Criar Perfil de Administrador REST API" inteiramente.

**Adicionar nota informativa** após os passos explicando por que `super_admin_readonly` é seguro para este uso:
- É um perfil nativo do FortiGate (somente-leitura)
- Não permite alterações de configuração
- Garante visibilidade completa para coleta de dados de compliance

### Observação sobre SSL (manter sem alteração)
O aviso sobre porta 8443 e SSL permanece igual.

## Arquivo modificado

- `src/pages/environment/AddFirewallPage.tsx` — função `FortiGateInstructions` (linhas 141–188): reduzir de 3 para 2 passos, remover criação de perfil customizado, referenciar `super_admin_readonly` no texto e no snippet CLI, adicionar nota informativa sobre o perfil nativo.
