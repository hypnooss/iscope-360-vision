

# Plano: Reordenar Abas do Template para Seguir o Pipeline

## Objetivo

Reorganizar as abas na pagina de detalhe do template (`TemplateDetailPage.tsx`) para seguir a mesma ordem logica do pipeline de processamento exibido em `TemplatePipelineFlow`.

---

## Ordem Atual vs Nova Ordem

| Posicao | Ordem Atual | Nova Ordem |
|---------|-------------|------------|
| 1 | Visualizacao | **Blueprints** |
| 2 | Fluxo de Analise | **Regras** |
| 3 | Blueprints | **Parses** |
| 4 | Regras | **Fluxo de Analise** |
| 5 | Parses | **Visualizacao** |
| 6 | Guia de Correcoes | **Guia de Correcoes** |

---

## Alteracoes Tecnicas

### Arquivo: `src/pages/admin/TemplateDetailPage.tsx`

1. **Alterar aba inicial padrao** (linha 57):
   - De: `useState('organize')`
   - Para: `useState('blueprints')`

2. **Reordenar TabsTrigger** (linhas 259-294):
   Nova ordem dos triggers:
   - blueprints
   - rules
   - parses
   - flow
   - organize
   - guides

3. **Reordenar TabsContent** (linhas 297-367):
   Nova ordem dos conteudos:
   - blueprints
   - rules
   - parses
   - flow
   - organize
   - guides

---

## Beneficios

- Consistencia visual entre o diagrama do pipeline e a navegacao por abas
- Fluxo logico de trabalho para administradores (configurar coleta antes de avaliar)
- Experiencia de usuario mais intuitiva

