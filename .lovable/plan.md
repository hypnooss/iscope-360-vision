
# Adicionar tooltips explicativos nos tipos de breach

## O que muda

Adicionar um tooltip em cada badge de tipo na coluna "Tipo" da tabela de credenciais vazadas, explicando em portugues o que cada classificacao significa.

## Alteracao

**Arquivo**: `src/components/external-domain/LeakedCredentialsSection.tsx`

1. Adicionar um campo `tooltip` ao `breachTypeConfig` com descricoes explicativas:
   - **Credential Leak**: "Vazamento real de credenciais (email + senha) obtidas em invasoes a sistemas e bancos de dados."
   - **Stealer Logs**: "Credenciais capturadas por malware (info-stealer) instalado no dispositivo da vitima."
   - **Scraping**: "Dados publicos coletados automaticamente de sites, redes sociais ou registros WHOIS. Nao envolve senhas."
   - **Combo List**: "Lista compilada a partir de multiplos vazamentos ou dados fabricados. Origem nao verificada."
   - **Desconhecido**: "Tipo de vazamento nao classificado. Execute uma nova consulta para atualizar."

2. Envolver cada badge de tipo com `Tooltip` / `TooltipTrigger` / `TooltipContent` (ja importados no projeto via `@/components/ui/tooltip`).

3. Adicionar um `TooltipProvider` ao redor da tabela (ou verificar se ja existe um no nivel superior).

Nenhuma outra alteracao e necessaria - apenas UI.
