
# Plano: Criar Regras de Compliance para SonicWall

## Diagnóstico Confirmado

A coleta do SonicWall está funcionando perfeitamente. Os dados foram coletados com sucesso incluindo:
- **version**: modelo, serial, firmware, uptime
- **interfaces**: configurações de rede IPv4
- **access_rules**: regras de firewall com DPI, Botnet Filter, GeoIP, etc.

O problema é que **não existem regras de compliance cadastradas para SonicWall**. O backend verifica se há regras antes de gerar o relatório:

```typescript
if (rules && rules.length > 0) {
  // Processa e gera relatório
}
```

Como `rules.length === 0`, nenhum relatório é criado.

---

## Solução

Criar uma migração SQL que insira regras de compliance específicas para SonicWall baseadas nos dados coletados.

### Regras a Criar (baseadas nos dados coletados)

| Código | Nome | Categoria | Severidade | O que verifica |
|--------|------|-----------|------------|----------------|
| SW_DPI_ENABLED | Deep Packet Inspection | Segurança de Rede | high | Se DPI está ativo nas regras |
| SW_BOTNET_FILTER | Filtro Botnet | Proteção Avançada | high | Se proteção botnet está ativa |
| SW_GEOIP_FILTER | Filtro GeoIP | Proteção Avançada | medium | Se filtragem geográfica está habilitada |
| SW_DPI_SSL_CLIENT | DPI SSL Client | Inspeção SSL | medium | Se inspeção SSL client está ativa |
| SW_DPI_SSL_SERVER | DPI SSL Server | Inspeção SSL | medium | Se inspeção SSL server está ativa |
| SW_LOGGING_ENABLED | Logging de Regras | Auditoria | medium | Se logging está habilitado nas regras |

---

## Estrutura das Regras

Cada regra terá a seguinte estrutura no `evaluation_logic`:

```json
{
  "source_key": "access_rules",
  "field_path": "access_rules.0.ipv4.dpi",
  "conditions": [
    { "operator": "equals", "value": true, "result": "pass" },
    { "operator": "equals", "value": false, "result": "fail" }
  ],
  "default_result": "unknown"
}
```

---

## Alterações

### Arquivo Novo

**Migração SQL: `[timestamp]_add_sonicwall_compliance_rules.sql`**

Insere 6 regras de compliance para o device type SonicWall TZ, permitindo que o sistema:
1. Avalie os dados coletados contra critérios de segurança
2. Calcule um score de compliance
3. Gere um relatório visual com categorias e status

---

## Resultado Esperado

Após a migração:
1. A próxima coleta do SonicWall gerará um relatório de compliance
2. O score será calculado baseado nas regras
3. O histórico de análise será salvo no `analysis_history`
4. Um alerta será criado notificando a conclusão
5. A lista de firewalls mostrará o score do SonicWall
