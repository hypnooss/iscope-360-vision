
## Pulse no botão "Buscar" quando habilitado

### O que fazer

No botão "Buscar" em `src/pages/environment/AddFirewallPage.tsx` (linha 944–948), adicionar a classe `pulse` condicionalmente: ela é aplicada apenas quando o botão está **habilitado** (ou seja, quando `fortigate_url` e `agent_id` estão preenchidos e `geoLoading` é falso).

### Mudança técnica

A classe `pulse` já está definida no `tailwind.config.ts` do projeto e aplica `animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]`, o efeito de brilho pulsante nativo do Tailwind.

**Condição para aplicar o pulse:**
```ts
!geoLoading && formData.fortigate_url && formData.agent_id
```

Quando o usuário preenche a URL e seleciona o Agent (pré-requisitos para habilitar o botão), o pulse começa. Ao clicar e iniciar o carregamento (`geoLoading = true`), o pulse para e o spinner aparece.

### Arquivo modificado

| Arquivo | Linha | Operação |
|---|---|---|
| `src/pages/environment/AddFirewallPage.tsx` | ~944 | Adicionar `className` condicional com classe `pulse` ao botão Buscar |
