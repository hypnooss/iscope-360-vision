# Status: ✅ Implementado

## Alteração: Divisão do Card "Tráfego Negado" em Entrada/Saída

### O que foi feito

1. **Tipos atualizados** (`src/types/analyzerInsights.ts`):
   - Substituído `denied_traffic` por `inbound_traffic` e `outbound_traffic` em `AnalyzerEventCategory`
   - Adicionadas novas entradas em `ANALYZER_CATEGORY_INFO` com labels, ícones e descrições apropriados

2. **Grid de categorias** (`src/components/firewall/AnalyzerCategoryGrid.tsx`):
   - Dois cards separados: "Tráfego de Entrada" e "Tráfego de Saída"
   - Barra bicolor proporcional: vermelho (negado) + verde (permitido)
   - Badges com contagem de Negado/Permitido

3. **Sheet padronizado** (`src/components/firewall/AnalyzerCategorySheet.tsx`):
   - Largura: 50vw
   - Abas inline (Entrada/Saída) no padrão M365
   - Conteúdo organizado por tab com Top IPs/Países Bloqueados e Permitidos
