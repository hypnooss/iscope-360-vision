

## Plano — Mostrar valores completos no email demo

O email atual mascara os scores (ex: `7•/100`) e os dados de rede (mostra apenas `•`). O usuário quer que o email mostre os **valores reais completos** — scores, findings e stats de rede — para que o destinatário veja a gravidade e fique curioso para baixar o PDF.

### Alterações

**Arquivo**: `supabase/functions/_shared/transactional-email-templates/domain-security-report.tsx`

1. **Remover `maskScore`** — exibir o score real (ex: `72/100` em vez de `7•/100`)
2. **Scores**: trocar `scoreValueMasked` por estilo com cor real (verde/amarelo/vermelho conforme valor)
3. **Network stats**: mostrar valores reais (`totalIPs`, `openPorts`, `services`, `cves`) em vez de `•`
4. **Manter o banner DEMO** e a mensagem de blur — mas agora o CTA fica mais forte porque o destinatário vê os números reais e quer os detalhes/correções

O restante do email (banner demo, CTA, footer) permanece igual.

**Deploy**: `deploy_edge_functions(["send-transactional-email"])` após a edição.

