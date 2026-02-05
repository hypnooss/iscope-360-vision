

## Correção: Mapeamento Errado de IDs no Guia de Correções do PDF

### Problema Identificado

O PDF está exibindo conteúdo explicativo **errado** para os checks que falharam. Por exemplo:
- Check **DNS-001** no backend = "DNSSEC Habilitado" (fail)
- Mas `EXPLANATORY_CONTENT` mapeia **DNS-001** para "Servidores DNS (Nameservers)"

Isso acontece porque os IDs das regras foram alterados no backend, mas o arquivo `explanatoryContent.ts` não foi atualizado.

---

### Mapeamento Atual (Backend) vs EXPLANATORY_CONTENT

| ID Backend | Nome Backend | ID no EXPLANATORY_CONTENT | Nome Antigo |
|------------|--------------|---------------------------|-------------|
| DNS-001 | DNSSEC Habilitado | DNS-001 | Servidores DNS (Nameservers) ❌ |
| DNS-002 | Registro DS na Zona Pai | DNS-002 | Servidor principal (SOA) ❌ |
| DNS-003 | Redundância de Nameservers | DNS-003 | Redundância de DNS ✓ |
| DNS-004 | Diversidade de Nameservers | DNS-004 | Diversidade de infraestrutura DNS ✓ |
| DNS-005 | SOA Serial Atualizado | - | (não existe) |
| DNS-006 | SOA Refresh Adequado | - | (não existe) |

O `EXPLANATORY_CONTENT` também tem `DNSSEC-001` e `DNSSEC-002`, que aparentemente são os IDs antigos para as regras de DNSSEC.

---

### Solução

Atualizar o arquivo `src/components/pdf/data/explanatoryContent.ts` para alinhar os IDs com o backend atual.

---

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/pdf/data/explanatoryContent.ts` | Reorganizar mapeamento de IDs DNS/DNSSEC |

---

### Mudanças Detalhadas

#### 1. Renomear/Realocar DNS-001 e DNS-002

**Antes:**
```typescript
'DNS-001': {
  friendlyTitle: 'Servidores DNS (Nameservers)',
  ...
},
'DNS-002': {
  friendlyTitle: 'Servidor principal (SOA)',
  ...
},
```

**Depois:**
```typescript
'DNS-001': {
  friendlyTitle: 'Proteção contra falsificação de DNS (DNSSEC)',
  whatIs: 'Sistema de segurança que protege o DNS contra ataques de envenenamento de cache.',
  whyMatters: 'Sem DNSSEC, atacantes podem redirecionar visitantes do seu site para páginas falsas sem você saber.',
  impacts: [
    'Visitantes podem ser redirecionados para sites falsos',
    'Risco de roubo de credenciais',
    'Emails podem ser interceptados',
  ],
  howToFix: [
    'Acesse o painel do seu provedor DNS (Cloudflare, AWS, etc.)',
    'Ative o DNSSEC nas configurações do domínio',
    'Copie os registros DS gerados',
    'Adicione os registros DS no registrador do domínio (Registro.br, etc.)',
  ],
  difficulty: 'medium',
  timeEstimate: '30 min',
  providerExamples: ['Cloudflare', 'Registro.br', 'AWS Route 53'],
},
'DNS-002': {
  friendlyTitle: 'Registro DS na Zona Pai',
  whatIs: 'Registro que conecta o DNSSEC do seu domínio com a zona pai (.com.br, .com, etc.).',
  whyMatters: 'Sem o registro DS, o DNSSEC não funciona pois falta o elo de confiança com a hierarquia DNS.',
  impacts: [
    'DNSSEC não funciona mesmo se ativado',
    'Proteção contra falsificação fica inativa',
    'Possíveis falhas de resolução DNS',
  ],
  howToFix: [
    'Acesse o painel do seu provedor DNS e copie os registros DS',
    'Vá ao registrador do domínio (Registro.br, GoDaddy, etc.)',
    'Adicione os registros DS na configuração DNSSEC',
    'Aguarde até 48 horas para propagação',
  ],
  difficulty: 'medium',
  timeEstimate: '30 min',
  providerExamples: ['Registro.br', 'GoDaddy', 'Cloudflare'],
},
```

#### 2. Adicionar DNS-005 e DNS-006

```typescript
'DNS-005': {
  friendlyTitle: 'Atualização do SOA Serial',
  whatIs: 'Número de série do registro SOA que indica quando a zona foi atualizada.',
  whyMatters: 'Servidores DNS usam o serial para saber quando sincronizar alterações.',
  impacts: [
    'Alterações DNS podem não propagar corretamente',
    'Servidores secundários podem ter dados desatualizados',
  ],
  howToFix: [
    'Verifique o formato do serial (recomendado: YYYYMMDDNN)',
    'Atualize o serial sempre que fizer alterações na zona',
    'A maioria dos provedores faz isso automaticamente',
  ],
  difficulty: 'low',
  timeEstimate: '10 min',
},
'DNS-006': {
  friendlyTitle: 'Intervalo de Refresh do SOA',
  whatIs: 'Tempo que servidores secundários esperam antes de verificar atualizações.',
  whyMatters: 'Valor muito alto atrasa propagação; muito baixo sobrecarrega os servidores.',
  impacts: [
    'Alterações DNS podem demorar a propagar',
    'Possível sobrecarga de consultas DNS',
  ],
  howToFix: [
    'Valor recomendado: 3600 a 86400 segundos (1 a 24 horas)',
    'Ajuste no registro SOA da zona DNS',
    'Provedores gerenciados geralmente usam valores otimizados',
  ],
  difficulty: 'low',
  timeEstimate: '10 min',
},
```

#### 3. Mover conteúdo antigo de Nameservers/SOA para DNSSEC-001/DNSSEC-002

O conteúdo atual de `DNSSEC-001` e `DNSSEC-002` pode ser mantido como está - eles funcionam como fallback ou podem ser removidos se não forem mais usados pelo backend.

---

### Resumo das Alterações

| ID | Antes | Depois |
|----|-------|--------|
| DNS-001 | Nameservers | DNSSEC Habilitado |
| DNS-002 | SOA | Registro DS na Zona Pai |
| DNS-003 | Redundância DNS | Redundância de Nameservers (mantido) |
| DNS-004 | Diversidade DNS | Diversidade de Nameservers (mantido) |
| DNS-005 | (novo) | SOA Serial Atualizado |
| DNS-006 | (novo) | SOA Refresh Adequado |

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar mapeamentos DNS-001 e DNS-002 | 10min |
| Adicionar DNS-005 e DNS-006 | 10min |
| Testar PDF com domínio gdmseeds.com | 10min |
| **Total** | **~30min** |

