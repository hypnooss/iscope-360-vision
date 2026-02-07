

# Corrigir Exibição do Template M365 sem Blueprint

## Problema Identificado

A página `TemplateDetailPage.tsx` exige um blueprint ativo para renderizar as abas "Visualização" e "Fluxo de Análise". Quando não há blueprint, exibe a mensagem "Configure um blueprint ativo para organizar categorias".

O M365 foi projetado para não usar blueprints (a coleta é feita via Graph API direta, não via agent com steps de coleta). Portanto, a lógica precisa ser ajustada para permitir visualização de categorias e regras mesmo sem blueprint.

## Dados no Banco

Os dados estão corretos:
- 11 categorias em `rule_categories`
- 57 regras em `compliance_rules`
- 0 blueprints (esperado para M365)

## Solução

Modificar a lógica de renderização das abas para:

1. **Aba "Visualização"**: Mostrar `DraggableCategoryFlow` se houver regras OU categorias configuradas (independente de blueprint)
2. **Aba "Fluxo de Análise"**: Manter exigência de blueprint (faz sentido apenas para templates que usam agent com steps de coleta)
3. Passar um blueprint "vazio" virtual para o `DraggableCategoryFlow` quando não houver blueprint real

## Detalhes Tecnicos

### Arquivo: `src/pages/admin/TemplateDetailPage.tsx`

#### Mudanca 1: Criar blueprint virtual para M365

Adicionar logica para criar um blueprint "vazio" quando nao houver blueprints:

```typescript
// Virtual blueprint for templates without blueprints (like M365)
const virtualBlueprint: Blueprint = {
  id: 'virtual',
  name: 'Virtual Blueprint',
  description: null,
  device_type_id: id!,
  version: '1.0',
  collection_steps: { steps: [] },
  is_active: false,
  created_at: new Date().toISOString(),
};

const blueprintForVisualization = activeBlueprint || (rules.length > 0 ? virtualBlueprint : null);
```

#### Mudanca 2: Ajustar renderizacao da aba "Visualizacao"

Alterar a condicao de renderizacao:

De:
```typescript
{activeBlueprint ? (
  <DraggableCategoryFlow ... />
) : (
  <div>Configure um blueprint...</div>
)}
```

Para:
```typescript
{blueprintForVisualization ? (
  <DraggableCategoryFlow 
    blueprint={blueprintForVisualization}
    ...
  />
) : (
  <div>Nenhuma regra de compliance configurada...</div>
)}
```

#### Mudanca 3: Manter aba "Fluxo de Analise" inalterada

A aba "Fluxo de Analise" continua exigindo `activeBlueprint` pois mostra os steps de coleta que so fazem sentido para templates que usam agent.

### Resultado Esperado

- **M365**: Mostrara as 11 categorias e 57 regras na aba "Visualizacao", permitindo gerenciamento completo
- **Firewall/Dominio Externo**: Comportamento inalterado (continua exigindo blueprint para aba "Visualizacao")
- **Aba "Fluxo de Analise"**: Continua mostrando "Nenhum blueprint ativo" para M365 (correto, pois M365 nao usa agent)

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/admin/TemplateDetailPage.tsx` | Ajustar logica de renderizacao para suportar templates sem blueprints |

