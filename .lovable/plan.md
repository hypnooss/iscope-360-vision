
# Adicionar Passo 3 — Habilitar Acesso a Logs via REST API

## Contexto

O iScope coleta logs do FortiGate (tráfego, IPS, eventos de sistema, VPN) via REST API para alimentar o módulo de Security Intelligence (Analyzer). Para que isso funcione, é necessário habilitar especificamente o acesso a logs pela REST API no FortiGate, o que não é ativo por padrão.

O comando necessário é:

```
config log setting
    set rest-api-get enable
    set rest-api-performance enable
end
```

Sem esse passo, o token da API consegue consultar configurações (compliance), mas não consegue ler os logs — o que impede o funcionamento do módulo Analyzer.

## Estrutura atual dos passos (FortiGateInstructions)

```
Passo 1 — Criar REST API Admin       (linhas 144–195)
Passo 2 — Habilitar acesso via CLI   (linhas 197–212)
[Bloco segurança - Trusted Hosts]    (linhas 214–224)
[Info - super_admin_readonly]        (linhas 226–233)
[Aviso SSL]                          (linhas 235–240)
```

## Mudança no arquivo `src/pages/environment/AddFirewallPage.tsx`

### Inserir novo bloco entre o Passo 2 e o bloco de segurança (após linha 212)

Novo **Passo 3 — Habilitar acesso a logs via REST API**:

- Título com badge numerado `3`
- Breve explicação: sem essa config, os logs do firewall não ficam disponíveis para a API, impedindo o módulo de análise
- Snippet CLI:
```
config log setting
    set rest-api-get enable
    set rest-api-performance enable
end
```
- Nota inline: esse comando habilita leitura de logs em memória e métricas de performance via REST

### Bloco visual final (entre Passo 2 e aviso de segurança)

```tsx
<div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
  <h3>
    <span badge>3</span>
    Habilitar acesso a logs via REST API
  </h3>
  <div className="ml-8 space-y-2">
    <p className="text-sm text-muted-foreground">
      Por padrão, o FortiGate não expõe logs para a REST API.
      Execute o comando abaixo para habilitar a leitura de logs e métricas de performance:
    </p>
    <pre>
{`config log setting
    set rest-api-get enable
    set rest-api-performance enable
end`}
    </pre>
    <p className="text-xs text-muted-foreground">
      <strong>rest-api-get</strong> — permite consulta de logs de tráfego, IPS e eventos via API.<br/>
      <strong>rest-api-performance</strong> — expõe métricas de CPU, memória e sessões ativas.
    </p>
  </div>
</div>
```

## Arquivo modificado

- `src/pages/environment/AddFirewallPage.tsx` — função `FortiGateInstructions`: inserir novo bloco "Passo 3" após a linha 212 (fechamento do bloco do Passo 2), antes do bloco de aviso de segurança existente.
