

# Plano: Corrigir Endpoints da API SonicOS no Blueprint

## Problema Identificado

A coleta do SonicWall falhou em 12 dos 19 steps porque os paths da API estavam incorretos:

| Step | Erro | Causa |
|------|------|-------|
| gateway_av | 404 | Path incorreto |
| ips | 400 | Falta sub-recurso |
| anti_spyware | 400 | Falta sub-recurso |
| app_control | 400 | Falta sub-recurso |
| content_filter | 400 | Falta sub-recurso |
| geo_ip | 404 | Path incorreto |
| botnet | 404 | Path incorreto |
| vpn_ssl | 400 | Falta especificar server/client |
| vpn_ipsec | 400 | Path incorreto |
| log_settings | 400 | Falta sub-recurso |
| administration | 400 | Falta sub-recurso |
| licenses | 404 | Path incorreto |

## Endpoints Corrigidos

Baseado na documentação oficial da API SonicOS 7.x:

| Step ID | Path Atual (Incorreto) | Path Correto |
|---------|------------------------|--------------|
| gateway_av | `/api/sonicos/gateway-anti-virus` | `/api/sonicos/security-services/gateway-anti-virus` |
| ips | `/api/sonicos/intrusion-prevention` | `/api/sonicos/security-services/intrusion-prevention` |
| anti_spyware | `/api/sonicos/anti-spyware` | `/api/sonicos/security-services/anti-spyware` |
| app_control | `/api/sonicos/app-control` | `/api/sonicos/security-services/app-control/advanced` |
| content_filter | `/api/sonicos/content-filter` | `/api/sonicos/security-services/content-filter` |
| geo_ip | `/api/sonicos/geo-ip-filter` | `/api/sonicos/security-services/geo-ip/filter` |
| botnet | `/api/sonicos/botnet-filter` | `/api/sonicos/security-services/botnet/filter` |
| vpn_ssl | `/api/sonicos/vpn/ssl` | `/api/sonicos/vpn/ssl/server` |
| vpn_ipsec | `/api/sonicos/vpn/policies` | `/api/sonicos/vpn/policies/ipv4` |
| log_settings | `/api/sonicos/log/settings` | `/api/sonicos/log/settings/base` |
| administration | `/api/sonicos/administration` | `/api/sonicos/administration/settings` |
| licenses | `/api/sonicos/licenses` | `/api/sonicos/reporting/licenses` |

---

## Alteração Técnica

### Migração SQL

Atualizar o campo `collection_steps` do blueprint SonicWall (ID: `f1c656c0-75ed-43c6-b0a3-696498833094`) com os paths corretos da API.

O JSON atualizado manterá a mesma estrutura, apenas corrigindo o campo `path` em cada step afetado.

---

## Resultado Esperado

Após a migração:
1. Todos os 19 steps devem retornar HTTP 200
2. As regras de compliance terão dados reais para avaliar
3. O relatório mostrará status `pass`/`fail` ao invés de `unknown`
4. Score de segurança será calculado com precisão

---

## Observação

Após aplicar a correção, será necessário disparar uma nova análise do SonicWall para validar que todos os endpoints estão funcionando corretamente.

