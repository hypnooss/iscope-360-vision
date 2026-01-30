
Diagnóstico do porquê você não vê nada em “Administração > Coletas > Domínios Externos”
- A tela **/collections** (aba “Domínios Externos”) busca **device_types** por categoria `other`:
  - `external -> 'other'` (mapeamento em `CollectionsPage.tsx`)
- No banco (ambiente **test**), hoje **não existe** nenhum `device_types` com `code='external_domain'`:
  - Query executada: `select ... from device_types where code='external_domain'` retornou `[]`
- Também **não existe** nenhum `device_blueprints` associado a um device_type `external_domain`:
  - Query executada: `select ... from device_blueprints join device_types where code='external_domain'` retornou `[]`
- Ou seja: a RPC `rpc_get_agent_tasks` já foi atualizada para “buscar o blueprint no banco”, mas **os registros (device_type + blueprint) ainda não foram criados**, então:
  1) A aba “Domínios Externos” fica vazia
  2) A RPC cai no fallback `{"steps": []}` e o agente não recebe steps

O que precisa ser feito (para aparecer na UI e para o agent receber o blueprint do banco)
1) Criar o `device_type` do Domínio Externo no banco
   - Tabela: `public.device_types`
   - Campos esperados:
     - `vendor`: “iScope” (ou outro que você preferir)
     - `name`: “Domínio Externo”
     - `code`: `external_domain` (confirmado por você)
     - `category`: `other` (isso é essencial para cair na aba “Domínios Externos”)
     - `icon`: `Globe` (opcional)
     - `is_active`: true
   - Observação: RLS está ok para super_admin (existe policy “Super admins can manage device types”).

2) Criar o `device_blueprint` no banco para esse device_type
   - Tabela: `public.device_blueprints`
   - Campos esperados:
     - `device_type_id`: id do device_type criado acima
     - `name`: “External Domain DNS Scan”
     - `version`: “any”
     - `is_active`: true
     - `collection_steps`: JSON com steps:
       - ns_records (dns_query, NS)
       - mx_records (dns_query, MX)
       - soa_record (dns_query, SOA)
       - spf_record (dns_query, SPF)
       - dmarc_record (dns_query, DMARC)
       - dkim_records (dns_query, DKIM, selectors = lista aprovada)
       - dnssec_status (dns_query, DNSSEC, best_effort true)
   - Observação: também há policy para super_admin em device_blueprints.

3) Validar imediatamente na UI
   - Recarregar a página `/collections`
   - Ir na aba “Domínios Externos”
   - Esperado:
     - aparecer 1 card “Domínio Externo” (device_type)
     - dentro dele, aparecer 1 blueprint “External Domain DNS Scan” com os steps listados
   - Se não aparecer:
     - confirmar que você está logado como `super_admin`
     - confirmar que `is_active=true` no device_type e no blueprint
     - confirmar que `category='other'`

4) Ajuste final do python-agent (para blueprint genérico funcionar)
- Motivo: blueprint no banco não deve ter `config.domain` hardcoded.
- Implementação:
  - Alterar o executor `python-agent/agent/executors/dns_query.py` para:
    - usar `config.domain` se vier preenchido
    - caso contrário, derivar o domínio de `context.base_url` (que vem de `target.base_url` já montado na RPC como `https://{d.domain}`)
- Resultado esperado:
  - o mesmo blueprint serve para qualquer domínio cadastrado, sem duplicação por domínio.

Como vamos executar (passo a passo na implementação)
A) Banco (data operations)
- Inserir `device_types` (idempotente: checar por code antes; se existir, reutilizar id)
- Inserir `device_blueprints` (idempotente: checar se já existe ativo para esse device_type; se existir, não duplicar ou criar como inativo “v2”)

B) Código (python-agent)
- Pequena alteração em `dns_query.py` para fallback via `base_url`.

C) Validação end-to-end (o que você vai testar)
1) Administração > Coletas > Domínios Externos:
   - Ver o device type + blueprint.
2) Domínio Externo > Domínios:
   - Clicar “Analisar”.
3) Domínio Externo > Execuções:
   - Ver task com steps vindo do blueprint (não vazio).
4) Agent rodando:
   - Executa DNS steps e envia step_results.

Notas importantes
- A migração que você mostrou (RPC) está correta para “buscar blueprint no banco”, mas isso só funciona quando os dados existirem.
- O fato de você não ver nada na aba é consistente com “não existe device_type com category other/code external_domain no banco (test)”.

Arquivos/áreas envolvidas (para referência)
- UI: `src/pages/admin/CollectionsPage.tsx` (filtra por category = other na aba Domínios Externos)
- RPC: `public.rpc_get_agent_tasks` (já atualizado para buscar blueprint no banco)
- Python agent: `python-agent/agent/executors/dns_query.py` (falta ajuste para derivar domain do base_url)
