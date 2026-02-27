

## Plano: Layout 2 colunas + Sheet lateral nos Compliance de Firewall e Domínio Externo

### Resumo
Reorganizar os cards de compliance para exibição em grid de 2 colunas (como M365 Posture já faz) e substituir o "Detalhes" expandível inline por uma Sheet lateral com abas (como o `AssetDetailSheet` do Surface Analyzer).

### Mudanças

#### 1. Novo componente: `src/components/compliance/ComplianceDetailSheet.tsx`
- Sheet lateral (`side="right"`, `sm:max-w-[50vw]`)
- Recebe um `UnifiedComplianceItem` como prop
- Header: ícone de status + nome + badge de severidade
- Abas:
  - **Análise**: descrição contextual, análise efetuada, detalhes
  - **Risco**: risco técnico + impacto no negócio (apenas se falha)
  - **Evidências**: lista de evidências coletadas
  - **Dados** (super_admin only): endpoint consultado + JSON bruto
- Botão "Como Corrigir" no footer quando aplicável
- Reutiliza os mesmos `Section`, `EvidenceItemDisplay` que o card atual usa

#### 2. Modificar `UnifiedComplianceCard.tsx`
- Adicionar prop `onClick?: () => void`
- Remover o bloco `Collapsible` inteiro (Nível 3 - Detalhes Expandíveis)
- Tornar o card clicável (cursor-pointer) quando `onClick` está presente
- Manter "Detalhes" como texto clicável que chama `onClick` em vez de expandir inline

#### 3. Modificar `CategorySection.tsx` (Firewall)
- Mudar layout dos cards de `space-y-3` para `grid grid-cols-1 lg:grid-cols-2 gap-4`
- Adicionar estado para `selectedCheck` e controlar abertura do `ComplianceDetailSheet`
- Cada `ComplianceCard` recebe `onClick` que abre a sheet com o check selecionado

#### 4. Modificar `ExternalDomainCategorySection.tsx`
- Mesma mudança: grid 2 colunas + sheet lateral
- Cada card recebe `onClick` para abrir a sheet

#### 5. Modificar `ComplianceCard.tsx` (wrapper)
- Passar `onClick` para `UnifiedComplianceCard`

### Arquivos criados (1)
- `src/components/compliance/ComplianceDetailSheet.tsx`

### Arquivos editados (4)
- `src/components/compliance/UnifiedComplianceCard.tsx`
- `src/components/ComplianceCard.tsx`
- `src/components/CategorySection.tsx`
- `src/components/external-domain/ExternalDomainCategorySection.tsx`

### Notas técnicas
- O padrão de Sheet lateral já existe no projeto (`AssetDetailSheet`) e será replicado
- O M365 Posture já usa `grid grid-cols-1 lg:grid-cols-2 gap-4` — aplicamos o mesmo nos outros módulos
- A informação que hoje aparece no Collapsible será toda migrada para as abas da Sheet, sem perda de dados

