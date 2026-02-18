
# Ajustar FirewallEditPage: Botão Voltar + Botão Buscar

## Análise do Estado Atual

### Botão Voltar
Em `src/pages/firewall/FirewallEditPage.tsx` (linha 352), o botão Voltar navega para `/scope-firewall/firewalls`. Como o usuário chegou à tela de edição pela tela de Ambiente, precisa voltar para `/environment`.

### Botão Buscar (Geolocalização)
O `FirewallEditPage` usa a abordagem **antiga e descontinuada** (`resolveGeoFromUrl` direto do browser via `src/lib/geolocation.ts`), enquanto o `AddFirewallPage` usa a abordagem **correta e atual**:

1. Chama a edge function `resolve-firewall-geo` passando `agent_id`, `url` e credencial
2. Faz polling na tabela `agent_tasks` a cada 2s (máximo 60s)
3. Processa as interfaces WAN do FortiGate
4. Geolocaliza os IPs via `resolve-firewall-geo` (batch)
5. Se 1 candidato → aplica direto; se múltiplos → abre dialog para o usuário escolher
6. Exibe ponto de ping animado quando o botão está disponível

## O que será feito em `src/pages/firewall/FirewallEditPage.tsx`

### 1. Botão Voltar — navegar para `/environment`
Alterar a linha 352:
```tsx
// Antes:
onClick={() => navigate('/scope-firewall/firewalls')}
// Depois:
onClick={() => navigate('/environment')}
```
Também ajustar o botão "Cancelar" na linha 580 para a mesma rota.

### 2. Importações — adicionar o que falta
Adicionar ao import do lucide-react: `Globe` (usado no dialog WAN)
Adicionar import de `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` do radix (já importados no arquivo).
Remover o import de `resolveGeoFromUrl` de `@/lib/geolocation` (linha 19).

### 3. Estados — adicionar os novos
```ts
const [wanCandidates, setWanCandidates] = useState<WanCandidate[]>([]);
const [showWanDialog, setShowWanDialog] = useState(false);
```
E adicionar a interface `WanCandidate`.

### 4. Substituir o onClick do botão Buscar
Substituir a lógica simples do `resolveGeoFromUrl` pela lógica completa do `AddFirewallPage`:
- Valida `fortigate_url` e `agent_id` e credencial
- Chama `resolve-firewall-geo` com o agent
- Faz polling em `agent_tasks`
- Filtra interfaces WAN
- Geolocaliza via `resolve-firewall-geo` (batch)
- Se 1 candidato → aplica; se múltiplos → abre dialog

### 5. Adicionar ponto de ping animado no Buscar
Envolver o botão em `div.relative.inline-flex.shrink-0` com o ponto pingando quando `!geoLoading && formData.fortigate_url && formData.agent_id`.

### 6. Atualizar o `disabled` do botão
```tsx
// Antes:
disabled={geoLoading || !formData.fortigate_url}
// Depois:
disabled={geoLoading || !formData.fortigate_url || !formData.agent_id}
```

### 7. Adicionar o Dialog de seleção de WAN
Após o `</AppLayout>`, adicionar o mesmo `<Dialog>` do `AddFirewallPage` para seleção entre múltiplos IPs WAN, com `setFormData` adaptado para o estado do `FirewallEditPage`.

## Arquivo Alterado

- `src/pages/firewall/FirewallEditPage.tsx` — único arquivo a modificar

## Resumo

| Item | Mudança |
|---|---|
| Botão Voltar (header) | `/scope-firewall/firewalls` → `/environment` |
| Botão Cancelar (rodapé) | `/scope-firewall/firewalls` → `/environment` |
| Botão Buscar — lógica | Abordagem antiga (browser direto) → Abordagem nova (via Agent + polling) |
| Botão Buscar — ping visual | Adicionado |
| Botão Buscar — disabled | Inclui verificação de `agent_id` |
| Dialog WAN múltiplos IPs | Adicionado |
