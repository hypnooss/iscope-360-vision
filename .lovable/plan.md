
Objetivo
- Ajustar o banner de alertas (`SystemAlertBanner`) para que um alerta “viva” na UI por um tempo limitado após sua criação (default 30s), evitando que usuários que fazem login com baixa frequência vejam alertas antigos como se fossem novos.
- Manter o comportamento atual: o banner some antes se o usuário clicar em alguma ação (ex.: “Ver Análise”, “Ver Configurações”) ou dispensar (X).

O que existe hoje (estado atual)
- `src/components/alerts/SystemAlertBanner.tsx`
  - Busca alertas ativos (`is_active=true`) e ordena por `created_at`.
  - Filtra por `dismissed_by` (usuário atual).
  - Exibe apenas 1 alerta (o “primaryAlert”) com contagem de “+N outros”.
  - Não há lógica de expiração por tempo na UI.
  - Realtime já está configurado no frontend e, após o ajuste de publication no banco, deve começar a disparar eventos de `postgres_changes`.

Decisão de produto (confirmada por você)
- Regra principal: “Lifetime do banner” = 30 segundos a partir do `created_at`.
  - Durante esses 30s: o alerta pode aparecer e permanecer visível.
  - Após 30s: o alerta não deve mais ser exibido no banner (mesmo se continuar no banco como `is_active=true`).
- Referência de tempo: usar `created_at`.
- Exceção sugerida: alertas de M365 possivelmente com tempo maior (ou depender de ação do usuário).

Solução proposta (alto nível)
1) Implementar expiração por tempo na UI (client-side) usando `created_at`.
2) Auto-esconder o banner após o tempo restante do alerta atual (ex.: se o alerta já tem 12s, esconder em 18s).
3) Filtrar alertas “velhos” para não serem exibidos em nenhum momento (principalmente relevante no primeiro load após login).
4) Adicionar uma exceção de lifetime maior para alertas M365 (configurável), mantendo default 30s para os demais.

Detalhes técnicos (como será implementado)
A) Ajustes no componente `SystemAlertBanner.tsx`
1. Criar um helper para lifetime por tipo:
   - `DEFAULT_BANNER_LIFETIME_MS = 30_000`
   - `M365_BANNER_LIFETIME_MS = 300_000` (ex.: 5 min) OU outro valor fácil de ajustar
   - `getAlertLifetimeMs(alertType: string): number`
     - se `alertType.startsWith('m365_')` => retorna `M365_BANNER_LIFETIME_MS`
     - senão => retorna `DEFAULT_BANNER_LIFETIME_MS`

2. Filtrar alertas expirados logo após o fetch:
   - Após `filteredData` (já filtrado por dismissed_by), aplicar:
     - `ageMs = now - new Date(alert.created_at).getTime()`
     - manter apenas `ageMs >= 0` e `ageMs < getAlertLifetimeMs(alert.alert_type)`
   - Isso garante que, ao logar, alertas antigos não entram na lista e o banner não aparece.

3. Auto-hide baseado no alerta primário:
   - Adicionar um `useEffect` que observa `primaryAlert?.id` e `primaryAlert?.created_at` (e `primaryAlert?.alert_type`):
     - Calcula `remainingMs = getAlertLifetimeMs(primaryAlert.alert_type) - ageMs`
     - Se `remainingMs <= 0`: remover localmente (adicionar em `dismissedLocally`) ou simplesmente chamar `fetchActiveAlerts()` para reavaliar e pegar o próximo.
     - Se `remainingMs > 0`: iniciar um `setTimeout` para:
       - esconder o alerta atual ao expirar (ex.: adicionando `primaryAlert.id` em `dismissedLocally`)
       - e opcionalmente chamar `fetchActiveAlerts()` para “promover” o próximo alerta (se houver).
   - Garantir cleanup:
     - limpar o timeout no return do `useEffect` para evitar timers duplicados ao trocar de alerta (muito comum com realtime).

4. Manter ações do usuário com precedência:
   - `dismissAlert(alertId)` continua funcionando do mesmo jeito.
   - `handleViewAnalysis` já chama `dismissAlert` antes de navegar.
   - Para alertas M365, o botão “Ver Configurações” já existe via `asChild <Link>`.
     - Como é navegação via link, não chama `dismissAlert`. Podemos decidir se:
       - (A) Manter como está (navega, e o auto-hide/troca de rota resolve), ou
       - (B) Trocar para `onClick` que primeiro chama `dismissAlert(primaryAlert.id)` e depois navega.
     - Recomendo (B) para consistência com “ação do usuário encerra banner”.

5. Observabilidade (opcional, mas útil para suporte)
- Logar, em nível `debug`, quando:
  - um alerta for filtrado por expiração (para confirmar o comportamento em produção)
  - um auto-hide ocorrer por timer
- Evitar “console.log” verboso em prod se isso estiver incomodando; podemos trocar para logs condicionais ou remover após validação.

B) Considerações importantes / trade-offs
- Esta abordagem é “UI lifetime”: ela não altera o alerta no banco (`is_active` continua true) e não escreve em `dismissed_by` automaticamente quando expira. Isso atende ao seu pedido (“para não exibir alertas antigos”) sem mudar o comportamento global do sistema.
- Se futuramente vocês quiserem uma expiração real de dados, o banco já tem `expires_at` e as policies já respeitam `expires_at > now()`. A expiração server-side seria complementar (mas envolve alterar a forma como os alertas são criados pelo agent/edge functions).

Validação (critério de aceite)
1) Caso “login depois de dias”:
   - Se existir alerta com `created_at` antigo, o banner não deve aparecer ao entrar no dashboard.
2) Caso “alerta novo em tempo real”:
   - Um alerta criado agora deve aparecer sem refresh.
   - O banner deve sumir sozinho aproximadamente 30 segundos após `created_at` (ou conforme o tempo maior para M365, se aplicável).
3) Caso “ação do usuário”:
   - Clicar em “Ver Análise” deve remover o alerta e navegar.
   - Clicar em “X” deve remover o alerta e não voltar.
   - (Se aplicarmos a mudança) Clicar em “Ver Configurações” para M365 deve remover o alerta e navegar.
4) Caso “múltiplos alertas”:
   - Ao expirar o primary alert, o próximo (se ainda dentro do lifetime) deve assumir automaticamente sem refresh.

Arquivos que serão alterados
- `src/components/alerts/SystemAlertBanner.tsx`
  - Implementar filtro por idade, timer de expiração e (opcional) ajuste do botão de M365 para disparar dismiss antes de navegar.

Risco e mitigação
- Diferença de relógio (client vs server): em casos raros, o `created_at` pode parecer “no futuro” no cliente.
  - Mitigação: se `ageMs < 0`, tratar como 0 (não expirar imediatamente).
- Muitos eventos realtime podem causar refetches frequentes:
  - O filtro de expiração é barato; a parte pesada é o `fetchActiveAlerts()`.
  - Se necessário, podemos “debounce” o refetch em 300–500ms (não vou fazer agora a menos que você já esteja vendo spam).

Próximo passo de implementação
- Aplicar as mudanças no `SystemAlertBanner.tsx` conforme acima, testar no preview com um alerta inserido “agora” e outro “antigo”, e então publicar para validar em produção.