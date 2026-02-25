

# Exibir código de ativação na página de detalhe do Agent

## Situação atual

O card "Código de Ativação" já existe na `AgentDetailPage` (linhas 624-666) e funciona corretamente:
- Quando `activation_code` existe → mostra o código, botão copiar, expiração e instruções de instalação
- Quando `activation_code` é null → mostra "Nenhum código ativo" + botão "Gerar novo código"

O problema é que ao criar um Agent na `AgentsPage`, o código é exibido apenas no **dialog de criação**. O usuário precisa fechar o dialog e depois navegar manualmente para o Agent. Quando chega lá, o card já está com o código visível (se o agent ainda não registrou), mas o fluxo não é intuitivo.

## Plano

Após criar o Agent com sucesso na `AgentsPage`, **redirecionar automaticamente para a página de detalhe** (`/agents/{id}`) onde o card de ativação já exibe o código, as instruções de instalação e o botão de copiar — tudo pronto para uso.

### Mudança

| Arquivo | Descrição |
|---|---|
| `src/pages/AgentsPage.tsx` | Após criação bem-sucedida, chamar `navigate(\`/agents/${agentData.id}\`)` em vez de apenas mostrar o código no dialog |

Linhas ~279-281: após `setActivationCode(code)` e `toast.success`, adicionar `navigate(\`/agents/${agentData.id}\`)` e fechar o dialog. Remover o estado intermediário do dialog que exibe o código (já que o detalhe do agent faz isso melhor, com instruções completas).

