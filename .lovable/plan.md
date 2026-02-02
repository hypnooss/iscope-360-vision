

## Plano: Ajustes no PDF de Análise de Firewall - Fortigate

### Alterações Solicitadas

1. **Alterar título do relatório**
   - De: "Análise de Fortigate"
   - Para: "Análise de Firewall - Fortigate"

2. **Alterar recomendação da regra utm-007**
   - De: "Aplicar perfil Application Control"
   - Para: "Aplicar perfil Application Control em regras de saída"

3. **Adicionar card "Licenciamento e Firmware"**
   - Similar ao card "Autenticação de Email" do PDF de Domínios Externos
   - 3 indicadores: Firmware, Licenciamento, MFA

4. **Ajustar espaçamento e posição do card "Problemas Encontrados"**
   - Exibir abaixo na mesma página (Página 1)

---

### Alterações Técnicas

#### 1. Arquivo: `src/components/pdf/FirewallPDF.tsx`

**1.1 Alterar reportType no PDFHeader:**

```text
┌────────────────────────────────────────────────────────────┐
│ Linha 291:                                                  │
│                                                            │
│ De:   reportType="Análise de Fortigate"                    │
│ Para: reportType="Análise de Firewall - Fortigate"         │
└────────────────────────────────────────────────────────────┘
```

**1.2 Criar componente PDFFirewallStatusCards (inline):**

Estilo igual ao "Autenticação de Email" do PDFDomainInfo:

```text
┌────────────────────────────────────────────────────────────┐
│ LICENCIAMENTO E FIRMWARE                                   │
├────────────────────────────────────────────────────────────┤
│ ● Firmware        │ ● Licenciamento    │ ● MFA            │
│   Atualizado      │   Ativo            │   Ativo          │
└────────────────────────────────────────────────────────────┘
```

**1.3 Atualizar props do FirewallPDF:**

Adicionar novos campos à interface para suportar os dados:

```typescript
interface FirewallPDFProps {
  // ... campos existentes
  statusInfo?: {
    firmwareUpToDate?: boolean;
    licensingActive?: boolean;
    mfaEnabled?: boolean;
  };
}
```

**1.4 Layout da Página 1:**

```text
┌────────────────────────────────────────────────────────────┐
│ PAGE 1 - Sumário Executivo                                 │
├────────────────────────────────────────────────────────────┤
│ PDFHeader (Análise de Firewall - Fortigate)               │
│                                                            │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Score Gauge  │  Stats (Total/Aprovadas/Falhas)        │ │
│ │              │  Informações do Dispositivo            │ │
│ │              │  ┌─────────────────────────────────────┐│ │
│ │              │  │ LICENCIAMENTO E FIRMWARE            ││ │
│ │              │  │ ● Firmware ● Licenciamento ● MFA    ││ │
│ │              │  └─────────────────────────────────────┘│ │
│ └───────────────────────────────────────────────────────┘ │
│                                                            │
│ PDFCategorySummaryTable                                    │
│                                                            │
│ PDFIssuesSummary (movido para Página 1)                   │
│                                                            │
│ PDFFooter                                                  │
└────────────────────────────────────────────────────────────┘
```

---

#### 2. Arquivo: `src/components/Dashboard.tsx`

**2.1 Passar statusInfo para FirewallPDF:**

Calcular os valores com base nos dados do relatório:

```typescript
// Determinar status do Firmware
// Lógica: verificar se categoria "Firmware e Atualizações" existe
// e se tem checks passando

// Determinar status de Licenciamento
// Lógica: verificar categoria "Licenciamento" ou checks específicos

// Determinar status de MFA
// Lógica: verificar checks de autenticação multifator
```

---

#### 3. Banco de Dados: Atualizar recomendação da regra utm-007

**Query SQL:**

```sql
UPDATE compliance_rules 
SET recommendation = 'Aplicar perfil Application Control em regras de saída'
WHERE code = 'utm-007';
```

---

### Detalhes do Card "Licenciamento e Firmware"

| Indicador | Lógica de Avaliação | Status Positivo | Status Negativo |
|-----------|---------------------|-----------------|-----------------|
| Firmware | Verificar se versão está atualizada (check específico) | Atualizado | Desatualizado |
| Licenciamento | Verificar checks de licença FortiCare/FortiGuard | Ativo | Expirado |
| MFA | Verificar se admin-lockout ou 2FA está configurado | Ativo | Inativo |

**Regras para determinar status:**
- **Firmware**: Usar check `firmware_up_to_date` ou similar na categoria de Firmware
- **Licenciamento**: Verificar categoria "Licenciamento" - se pass rate > 50% = Ativo
- **MFA**: Verificar check específico de MFA. Se não existir = Inativo (dados indisponíveis)

---

### Estrutura Visual do Card (PDF)

```text
┌────────────────────────────────────────────────────────────┐
│ LICENCIAMENTO E FIRMWARE                                   │
│                                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ ●            │ │ ●            │ │ ●            │        │
│ │ Firmware     │ │ Licenciamento│ │ MFA          │        │
│ │ Atualizado   │ │ Ativo        │ │ Inativo      │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
└────────────────────────────────────────────────────────────┘

● Verde = Status positivo
● Vermelho = Status negativo
```

Cores:
- Indicador verde: `colors.success` (#10B981)
- Indicador vermelho: `colors.danger` (#EF4444)

---

### Resumo das Alterações por Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `FirewallPDF.tsx` | Alterar reportType; Adicionar seção "Licenciamento e Firmware"; Mover Issues para Página 1 |
| `Dashboard.tsx` | Passar statusInfo calculado para FirewallPDF |
| **Banco de Dados** | Atualizar recommendation da regra utm-007 |

---

### Resultado Esperado

1. **Header do PDF**: "Análise de Firewall - Fortigate"

2. **Recomendação correta**: "Recomendação: Aplicar perfil Application Control em regras de saída"

3. **Card de status** com 3 indicadores visuais (igual ao email auth do Domain PDF)

4. **Layout otimizado**: Página 1 contém todo o sumário executivo incluindo problemas encontrados

