

## Plano: Humanização das Evidências de Autenticação

### Objetivo
Melhorar a exibição das evidências para os itens de autenticação (SAML, RADIUS, SSO, LDAP), substituindo JSONs ou arrays vazios por textos amigáveis para usuários leigos.

---

### Regras Afetadas

| Código | Nome | source_key | Lógica Especial |
|--------|------|------------|-----------------|
| auth-001 | Servidores LDAP com Criptografia | user_ldap | `secure === 'ldaps'` para pass |
| auth-002 | Configuração de Servidores RADIUS | user_radius | Exibir servidor e porta |
| auth-003 | Configuração de SSO (Fortinet SSO) | user_fsso | Exibir servidor e porta |
| auth-004 | Configuração de SAML | user_saml | Exibir nome do IdP e SSO URL |

---

### Comportamento Esperado

#### Quando `results[]` está vazio (nenhuma configuração):

```text
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status         │ Nenhum servidor configurado               │
└────────────────────────────────────────────────────────────┘
```

#### Quando há configurações (auth-001 - LDAP):

```text
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status         │ ❌ 2 servidores sem criptografia          │
│                │                                            │
│ Servidor       │ LDAP (10.20.2.212:389)                    │
│ Criptografia   │ Desabilitada                              │
│                │                                            │
│ Servidor       │ LDAP-Onpremises (172.16.10.5:389)         │
│ Criptografia   │ Desabilitada                              │
└────────────────────────────────────────────────────────────┘
```

#### Quando há LDAP com criptografia (ldaps):

```text
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status         │ ✅ 2 servidores com criptografia          │
│                │                                            │
│ Servidor       │ LDAP-Secure (ldaps.empresa.com:636)       │
│ Criptografia   │ LDAPS                                     │
│                │                                            │
│ Servidor       │ LDAP-Backup (ldap-bkp.empresa.com:636)    │
│ Criptografia   │ LDAPS                                     │
└────────────────────────────────────────────────────────────┘
```

#### Quando há configurações (auth-002 - RADIUS):

```text
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status         │ ✅ 2 servidores RADIUS configurados       │
│                │                                            │
│ Servidor       │ RADIUS-Primary (192.168.1.10:1812)        │
│ Servidor       │ RADIUS-Backup (192.168.1.11:1812)         │
└────────────────────────────────────────────────────────────┘
```

#### Quando há configurações (auth-003 - SSO):

```text
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status         │ ✅ 1 agente FSSO configurado              │
│                │                                            │
│ Servidor       │ FSSO-Agent (10.20.2.100:8000)             │
└────────────────────────────────────────────────────────────┘
```

#### Quando há configurações (auth-004 - SAML):

```text
┌────────────────────────────────────────────────────────────┐
│ EVIDÊNCIAS COLETADAS                                       │
├────────────────────────────────────────────────────────────┤
│ Status         │ ✅ 1 provedor SAML configurado            │
│                │                                            │
│ Provedor       │ AzureAD-SSO                               │
│ URL SSO        │ https://login.microsoftonline.com/...     │
└────────────────────────────────────────────────────────────┘
```

---

### Alterações Técnicas

#### 1. Arquivo: `supabase/functions/agent-task-result/index.ts`

**1.1 Adicionar mapeamento de endpoints de autenticação**

Adicionar ao `sourceKeyToEndpoint`:
```typescript
'user_ldap': '/api/v2/cmdb/user/ldap',
'user_radius': '/api/v2/cmdb/user/radius', 
'user_fsso': '/api/v2/cmdb/user/fsso',
'user_saml': '/api/v2/cmdb/user/saml',
```

**1.2 Criar função `formatLDAPEvidence` (auth-001)**

```text
Lógica:
1. Extrair results[] de user_ldap
2. Se vazio → Status: "Nenhum servidor configurado", status: fail
3. Se existem servidores:
   a. Contar quantos têm secure === 'ldaps'
   b. Para cada servidor: extrair name, server, port, secure
   c. Se TODOS têm ldaps → status: pass
   d. Se ALGUM não tem ldaps → status: fail

Evidências:
- Status: "✅ X servidores com criptografia" ou "❌ X servidores sem criptografia"
- Para cada servidor:
  - Servidor: "{name} ({server}:{port})"
  - Criptografia: "LDAPS" ou "Desabilitada"
```

**1.3 Criar função `formatRADIUSEvidence` (auth-002)**

```text
Lógica:
1. Extrair results[] de user_radius
2. Se vazio → Status: "Nenhum servidor configurado", status: pass (warn por padrão)
3. Se existem servidores:
   a. Para cada servidor: extrair name, server, radius-port
   
Evidências:
- Status: "✅ X servidores RADIUS configurados" ou "Nenhum servidor configurado"
- Para cada servidor:
  - Servidor: "{name} ({server}:{radius-port})"
```

**1.4 Criar função `formatFSSOEvidence` (auth-003)**

```text
Lógica:
1. Extrair results[] de user_fsso
2. Se vazio → Status: "Nenhum agente configurado", status: warn (padrão)
3. Se existem agentes:
   a. Para cada agente: extrair name, server, port
   
Evidências:
- Status: "✅ X agente(s) FSSO configurado(s)" ou "Nenhum agente configurado"
- Para cada agente:
  - Servidor: "{name} ({server}:{port})"
```

**1.5 Criar função `formatSAMLEvidence` (auth-004)**

```text
Lógica:
1. Extrair results[] de user_saml
2. Se vazio → Status: "Nenhum provedor configurado", status: warn (padrão)
3. Se existem provedores:
   a. Para cada provedor: extrair name, idp-single-sign-on-url

Evidências:
- Status: "✅ X provedor(es) SAML configurado(s)" ou "Nenhum provedor configurado"
- Para cada provedor:
  - Provedor: "{name}"
  - URL SSO: "{idp-single-sign-on-url}" (truncado se muito longo)
```

**1.6 Adicionar tratamento no loop principal**

Adicionar blocos condicionais no loop principal (após os existentes):

```typescript
} else if (rule.code === 'auth-001') {
  // LDAP com criptografia
  const ldapResult = formatLDAPEvidence(rawData);
  evidence = ldapResult.evidence;
  status = ldapResult.status;
  details = status === 'pass' 
    ? rule.pass_description || 'Servidores LDAP com criptografia'
    : (ldapResult.hasServers 
      ? (rule.fail_description || 'Servidores LDAP sem criptografia')
      : 'Nenhum servidor LDAP configurado');
} else if (rule.code === 'auth-002') {
  // RADIUS
  const radiusResult = formatRADIUSEvidence(rawData);
  evidence = radiusResult.evidence;
  // Manter status original (pass se existe, warn se não)
} else if (rule.code === 'auth-003') {
  // FSSO
  const fssoResult = formatFSSOEvidence(rawData);
  evidence = fssoResult.evidence;
  // Manter status original
} else if (rule.code === 'auth-004') {
  // SAML
  const samlResult = formatSAMLEvidence(rawData);
  evidence = samlResult.evidence;
  // Manter status original
}
```

**1.7 Otimizar rawData para regras auth-***

Adicionar ao bloco de rawData:

```typescript
} else if (rule.code.startsWith('auth-')) {
  // Para regras de autenticação, incluir apenas dados relevantes
  const sourceKey = logic.source_key;
  const sourceData = rawData[sourceKey] as Record<string, unknown> | undefined;
  if (sourceData) {
    const results = (sourceData.results || []) as Array<Record<string, unknown>>;
    checkRawData = {
      [sourceKey]: {
        count: results.length,
        servers: results.map(s => ({
          name: s.name,
          server: s.server,
          port: s.port || s['radius-port'],
          secure: s.secure // apenas para LDAP
        }))
      }
    };
  }
}
```

---

### Campos do FortiGate por Tipo

| Campo | user_ldap | user_radius | user_fsso | user_saml |
|-------|-----------|-------------|-----------|-----------|
| name | ✅ | ✅ | ✅ | ✅ |
| server | ✅ | ✅ | ✅ | - |
| port | ✅ (389/636) | - | ✅ | - |
| radius-port | - | ✅ (1812) | - | - |
| secure | ✅ (ldaps/disable) | - | - | - |
| idp-single-sign-on-url | - | - | - | ✅ |

---

### Resultado Esperado

1. **Quando não há configurações**: 
   - Exibe "Nenhum servidor configurado" em vez de `results[]`
   - Status adequado (fail para LDAP, warn para outros)

2. **Quando há configurações**:
   - Lista cada servidor com nome, endereço e porta
   - Para LDAP: indica se tem criptografia LDAPS
   - Sem exibição de JSON ou dados técnicos

3. **Validação LDAP (auth-001)**:
   - Status `pass` apenas se TODOS os servidores têm `secure: 'ldaps'`
   - Status `fail` se qualquer servidor não tem criptografia

