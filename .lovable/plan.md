
# Plano: Correção das Evidências de VPN

## Problemas Identificados

### 1. Certificado SSL VPN (`vpn-003`)
- **Problema**: Exibe "Porta 443" nas evidências, irrelevante para check de certificado
- **Causa**: Linha 444 adiciona a porta desnecessariamente

### 2. Criptografia IPsec VPN (`vpn-001`)  
- **Problema**: Não exibe "Endpoint consultado" e evidências mostram "Dados não disponíveis"
- **Causa**: O `source_key` no banco é `vpn_ipsec_phase1` mas:
  - `sourceKeyToEndpoint` só tem entrada para `vpn_ipsec` 
  - `formatVPNEvidence` busca `rawData['vpn_ipsec']` ao invés de `rawData['vpn_ipsec_phase1']`
- **JSON bruto**: Está sendo exibido pelo bloco genérico (linha 1068)

---

## Alterações Necessárias

### Arquivo: `supabase/functions/agent-task-result/index.ts`

#### Mudança 1: Adicionar mapeamento para `vpn_ipsec_phase1` (linha ~199)

```typescript
// Adicionar nova entrada
'vpn_ipsec_phase1': '/api/v2/cmdb/vpn.ipsec/phase1-interface',
```

#### Mudança 2: Corrigir busca de dados IPsec (linhas 407-410)

```typescript
// ANTES
if (ruleCode === 'vpn-001') {
  const vpnData = rawData['vpn_ipsec'] as Record<string, unknown> | undefined;
  if (!vpnData) {
    return [{ label: 'VPN IPsec', value: 'Dados não disponíveis', type: 'text' }];
  }

// DEPOIS
if (ruleCode === 'vpn-001') {
  // Buscar tanto vpn_ipsec quanto vpn_ipsec_phase1 (compatibilidade)
  const vpnData = (rawData['vpn_ipsec_phase1'] || rawData['vpn_ipsec']) as Record<string, unknown> | undefined;
  if (!vpnData) {
    return [{ label: 'VPN IPsec', value: 'Dados não disponíveis', type: 'text' }];
  }
```

#### Mudança 3: Remover porta do SSL VPN (linha 444)

```typescript
// ANTES (linhas 443-444)
evidence.push({ label: 'Certificado', value: servercert, type: 'code' });
evidence.push({ label: 'Porta', value: String(loginPort), type: 'text' });

// DEPOIS (remover linha 444)
evidence.push({ label: 'Certificado', value: servercert, type: 'code' });
// Linha da porta removida - irrelevante para check de certificado
```

#### Mudança 4: Tratamento específico de rawData para VPN (após linha 1052)

Adicionar tratamento específico para regras VPN antes do bloco genérico:

```typescript
} else if (rule.code.startsWith('vpn-')) {
  // Para regras VPN, incluir dados específicos
  if (rule.code === 'vpn-001') {
    const vpnData = rawData['vpn_ipsec_phase1'] || rawData['vpn_ipsec'];
    if (vpnData) {
      const results = ((vpnData as Record<string, unknown>).results || []) as Array<Record<string, unknown>>;
      // Incluir apenas campos relevantes das VPNs
      checkRawData = {
        vpns_configuradas: results.map(vpn => ({
          name: vpn.name,
          proposal: vpn.proposal,
          ike_version: vpn['ike-version'],
          authmethod: vpn.authmethod,
          interface: vpn.interface,
          remote_gw: vpn['remote-gw']
        }))
      };
    }
  } else if (rule.code === 'vpn-003') {
    const sslData = rawData['vpn_ssl_settings'];
    if (sslData) {
      const results = (sslData as Record<string, unknown>).results as Record<string, unknown> || sslData;
      checkRawData = {
        ssl_vpn_config: {
          servercert: results.servercert,
          status: results.status,
          algorithm: results.algorithm
        }
      };
    }
  }
}
```

---

## Resumo das Alterações

| Local | Alteração |
|-------|-----------|
| Linha 199 | Adicionar mapeamento `vpn_ipsec_phase1` |
| Linha 408 | Buscar dados em `vpn_ipsec_phase1` OU `vpn_ipsec` |
| Linha 444 | Remover exibição de "Porta" no SSL VPN |
| Linhas 1053+ | Tratamento específico de rawData para regras `vpn-*` |

---

## Resultado Esperado

### Certificado SSL VPN (`vpn-003`)
- **Endpoint consultado**: `/api/v2/cmdb/vpn.ssl/settings`
- **Evidências**: Apenas `Certificado: nome-do-cert` (sem porta)
- **JSON bruto**: Dados resumidos do certificado SSL VPN

### Criptografia IPsec VPN (`vpn-001`)
- **Endpoint consultado**: `/api/v2/cmdb/vpn.ipsec/phase1-interface`
- **Evidências**: Lista de VPNs com propostas de criptografia (ícone verde/amarelo)
- **JSON bruto**: Lista de VPNs com campos relevantes (name, proposal, ike-version, etc)

---

## Validação

1. Execute nova análise do firewall
2. Verifique cards de VPN:
   - SSL VPN deve mostrar apenas certificado (sem porta)
   - IPsec VPN deve mostrar endpoint + evidências das VPNs configuradas
   - JSON bruto deve ser resumido e relevante
