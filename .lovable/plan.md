
## Correção da Evidência para SPF-003 (Limite de DNS Lookups SPF)

### Problema Identificado
A regra SPF-003 verifica se o SPF não excede 10 mecanismos que causam DNS lookups. No entanto, quando o domínio não possui nenhum mecanismo `include` (como `v=spf1 a mx ip4:200.150.200.46 -all`), a evidência exibe "Mecanismos Include []" (array vazio), que é confuso e não representa a análise real.

### Análise Técnica do SPF
O limite de 10 lookups DNS do SPF afeta os seguintes mecanismos:
- **include:** - cada include causa 1+ lookups (recursivo)
- **a** - causa 1 lookup
- **mx** - causa 1 lookup
- **ptr** - causa 1 lookup (deprecated)
- **exists:** - causa 1 lookup
- **redirect=** - causa 1+ lookups (recursivo)

Mecanismos que **NÃO** causam lookups:
- **ip4:** - IP direto, sem lookup
- **ip6:** - IP direto, sem lookup
- **all** - final qualifier, sem lookup

### Dados Disponíveis do Python Agent
O agent já retorna todos os mecanismos parseados:
```json
{
  "includes": [],
  "ip4": ["200.150.200.46"],
  "ip6": [],
  "a": ["a"],
  "mx": ["mx"],
  "exists": [],
  "redirect": null,
  "all": "-all"
}
```

### Solução Proposta

Criar um case específico para a regra **SPF-003** no backend que:
1. Contabilize todos os mecanismos que causam DNS lookups
2. Exiba uma evidência humanizada com a contagem
3. Liste quais mecanismos estão causando lookups

**Arquivo:** `supabase/functions/agent-task-result/index.ts`

Adicionar após o case `DMARC-006` (linha ~2226):

```typescript
// SPF-003: Limite de DNS Lookups SPF
else if (rule.code === 'SPF-003') {
  const spfData = sourceData as Record<string, unknown>;
  const parsed = ((spfData?.data as Record<string, unknown>)?.parsed || {}) as Record<string, unknown>;
  
  // Mecanismos que causam DNS lookups
  const includes = Array.isArray(parsed.includes) ? parsed.includes as string[] : [];
  const aMechanisms = Array.isArray(parsed.a) ? parsed.a as string[] : [];
  const mxMechanisms = Array.isArray(parsed.mx) ? parsed.mx as string[] : [];
  const existsMechanisms = Array.isArray(parsed.exists) ? parsed.exists as string[] : [];
  const redirect = parsed.redirect ? 1 : 0;
  
  // Contar total de lookups
  const totalLookups = includes.length + aMechanisms.length + mxMechanisms.length + existsMechanisms.length + redirect;
  
  // Montar lista de mecanismos que causam lookups
  const lookupMechanisms: string[] = [];
  if (includes.length > 0) {
    lookupMechanisms.push(`${includes.length} include(s)`);
  }
  if (aMechanisms.length > 0) {
    lookupMechanisms.push(`${aMechanisms.length} a`);
  }
  if (mxMechanisms.length > 0) {
    lookupMechanisms.push(`${mxMechanisms.length} mx`);
  }
  if (existsMechanisms.length > 0) {
    lookupMechanisms.push(`${existsMechanisms.length} exists`);
  }
  if (redirect) {
    lookupMechanisms.push(`1 redirect`);
  }
  
  if (totalLookups === 0) {
    evidence = [{
      label: 'Lookups DNS',
      value: 'Nenhum mecanismo que causa lookup DNS (apenas ip4/ip6)',
      type: 'text'
    }];
  } else {
    evidence = [{
      label: 'Lookups DNS',
      value: `${totalLookups} de 10 permitidos`,
      type: 'text'
    }, {
      label: 'Mecanismos',
      value: lookupMechanisms.join(', '),
      type: 'text'
    }];
  }
}
```

### Resultado Visual Esperado

**Caso: Domínio sem includes (agudos.sp.gov.br)**
Registro SPF: `v=spf1 a mx ip4:200.150.200.46 -all`

```
EVIDÊNCIAS COLETADAS
├── Lookups DNS: 2 de 10 permitidos
└── Mecanismos: 1 a, 1 mx
```

**Caso: Domínio com múltiplos includes**
Registro SPF: `v=spf1 include:_spf.google.com include:spf.protection.outlook.com -all`

```
EVIDÊNCIAS COLETADAS
├── Lookups DNS: 2 de 10 permitidos
└── Mecanismos: 2 include(s)
```

**Caso: Domínio só com IPs**
Registro SPF: `v=spf1 ip4:192.168.1.1 ip4:10.0.0.1 -all`

```
EVIDÊNCIAS COLETADAS
└── Lookups DNS: Nenhum mecanismo que causa lookup DNS (apenas ip4/ip6)
```

### Arquivos a Modificar
1. `supabase/functions/agent-task-result/index.ts` - Adicionar case específico para SPF-003
