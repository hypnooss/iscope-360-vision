
## Contexto e objetivo (o que você pediu)
Você quer ajustar a área expandida dos itens da **Análise de Compliance (Domínios Externos)**:

1) Trocar o título **“EVIDÊNCIAS COLETADAS”** por **“ANÁLISE EFETUADA”**  
2) Onde hoje aparece um box com `data.records` (evidência), **remover esse box**  
3) No lugar dele, mostrar o conteúdo que hoje está no box **“Detalhes”** (ex.: “Menos de 3 nameservers. Considere adicionar mais para resiliência.”)  
4) Essa “ANÁLISE EFETUADA” deve ser visível para **todos os usuários do workspace** (não só Super Admin).  
5) **Endpoint consultado** e **Dados brutos (JSON)** continuam **apenas para Super Admins**.

Além disso, esse comportamento deve valer para **todos os itens** do relatório de Domínio Externo, não só “Diversidade de Nameservers”.

---

## Diagnóstico (onde isso está hoje no código)
- O bloco “Evidências Coletadas” e “Ver dados brutos (JSON)” é renderizado em:  
  `src/components/ComplianceCard.tsx`
- Hoje existe a regra:
  - `canViewEvidence = role === 'super_admin' || role === 'super_suporte'`
  - Isso controla evidências, endpoint e JSON.
- O componente `ComplianceCard` é usado dentro de `CategorySection` (genérico), que é usado por Firewall, Domínio Externo e possivelmente outros relatórios.

Risco atual: se alterarmos `ComplianceCard` “no geral”, podemos afetar Firewall/M365. Então precisamos aplicar a mudança **somente** para Domínio Externo.

---

## Estratégia (como vamos aplicar apenas no Domínio Externo)
### Opção escolhida: “variant” explícito (mais seguro)
1) Adicionar um prop opcional em `CategorySection` para indicar o tipo de relatório (ex.: `variant?: 'default' | 'external_domain'`).
2) `CategorySection` repassa esse `variant` para cada `ComplianceCard`.
3) `ExternalDomainAnalysisReportPage.tsx` passa `variant="external_domain"` ao renderizar as categorias.
4) Dashboard/Firewall/M365 continuam sem prop (default), então não muda nada nesses módulos.

Isso evita heurísticas frágeis (ex.: tentar adivinhar pelo nome da categoria/step_id) e garante que a mudança ficará restrita ao Domínio Externo.

---

## Mudanças de UI/Comportamento (como ficará o expand do card no Domínio Externo)
### Quando `variant === 'external_domain'`:
- Remover o box “Detalhes” (para não duplicar informação)
- Criar a seção:
  - Título: **ANÁLISE EFETUADA**
  - Conteúdo: um box com o texto que hoje vem de `check.details || check.description`
  - Se o texto for grande: truncar ou manter quebra de linha?  
    - Vamos manter `whitespace-pre-line` (como já está), e limitar o layout usando `line-clamp` opcional + “ver mais” se precisar (se você preferir eu implemento já no mesmo passo; caso contrário, só mantém o comportamento atual do box, que já é bem estável).
- **Não renderizar a lista de `check.evidence`** (incluindo `data.records`), ou seja, o “box do data.records” deixa de existir.
- Continuar exibindo para Super Admin:
  - `Endpoint consultado`
  - `Ver dados brutos (JSON)`

### Para outros módulos (default):
- Nada muda: mantém “Detalhes”, “Evidências Coletadas” (para Super Admins), etc.

---

## Regras de acesso (como vamos garantir a visibilidade correta)
- A nova seção **ANÁLISE EFETUADA** no variant `external_domain`:
  - Deve aparecer para qualquer usuário autenticado que consiga ver o relatório.
  - Então ela NÃO depende de `canViewEvidence` (Super Admin).
- “Endpoint consultado” e “Dados brutos (JSON)”:
  - Continuam dependendo de `canViewEvidence` (super_admin ou super_suporte), como hoje.

---

## Passo a passo de implementação (arquivos e alterações)
1) **`src/components/ComplianceCard.tsx`**
   - Adicionar prop opcional `variant?: 'default' | 'external_domain'`
   - Ajustar renderização do bloco expandido:
     - Se `variant === 'external_domain'`:
       - Renderizar cabeçalho “ANÁLISE EFETUADA”
       - Renderizar 1 box com o texto do “Detalhes” (`check.details || check.description`)
       - Não renderizar a seção “Evidências Coletadas” nem itens `check.evidence`
     - Caso contrário:
       - Mantém o fluxo atual (inclui “Detalhes” + “Evidências Coletadas” para Super Admins)

2) **`src/components/CategorySection.tsx`**
   - Adicionar prop `variant?: 'default' | 'external_domain'`
   - Passar `variant` para `<ComplianceCard ... />`

3) **`src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`**
   - Ao renderizar `<CategorySection ... />`, passar `variant="external_domain"`

---

## Critérios de aceite (como validar que ficou certo)
1) No relatório de Domínio Externo, ao expandir qualquer check:
   - Não existe mais “EVIDÊNCIAS COLETADAS”
   - Existe “ANÁLISE EFETUADA”
   - O texto exibido corresponde ao que antes estava no box “Detalhes”
   - Não existe mais box de `data.records`
2) Logar com um usuário comum (role `user` / `workspace_admin`):
   - Consegue ver “ANÁLISE EFETUADA”
   - Não vê endpoint consultado nem JSON
3) Logar como `super_admin`:
   - Vê “ANÁLISE EFETUADA”
   - Vê endpoint consultado e JSON
4) Relatórios de Firewall continuam iguais (sem regressão visual/textual).

---

## Observações técnicas (curtas)
- Essa mudança é puramente de UI/visibilidade; não altera banco nem edge functions.
- Mantém o padrão de segurança atual: detalhes “sensíveis” (endpoint e raw json) continuam restritos.

---

## Teste end-to-end sugerido (rápido)
- Abrir a rota atual que você mencionou:
  `/scope-external-domain/domains/.../report/...`
- Expandir “Segurança DNS > Diversidade de Nameservers”
- Validar com usuário comum e com Super Admin (se possível em duas sessões/navegadores).

