

# Plano: Limpeza de Dados Mockados e Fluxo Visual em Templates

## Descobertas da Auditoria de Dados Mockados

### Arquivos que podem ser removidos (codigo morto):

| Arquivo | Motivo |
|---------|--------|
| `src/data/mockCompliance.ts` | Nao esta sendo importado em nenhum lugar do codigo |

### Arquivos de preview (opcional manter):

| Arquivo | Status |
|---------|--------|
| `src/pages/preview/FirewallReportPreview.tsx` | Pagina de preview de design - dados mock sao esperados |
| `src/pages/preview/DomainReportPreview.tsx` | Pagina de preview de design - dados mock sao esperados |

### Fallback com plano de migracao:

| Arquivo | Status |
|---------|--------|
| `src/components/pdf/data/explanatoryContent.ts` | Ja tem fallback para banco (rule_correction_guides). O conteudo hardcoded so e usado quando nao existe no banco |

---

## Nova Funcionalidade: Fluxo Visual do Template

### Objetivo

Adicionar um diagrama visual horizontal entre o titulo da pagina de Templates e a tabela, mostrando como os templates funcionam no sistema.

### Componente: TemplatePipelineFlow

Sera criado um novo componente `TemplatePipelineFlow.tsx` que exibe:

```text
+-------------------+     +-------------------+     +-------------------+     +-------------------+     +-------------------+
|     BLUEPRINT     |     |      REGRAS       |     |      PARSES       |     | FLUXO DE ANALISE  |     |   VISUALIZACAO    |
|-------------------|     |-------------------|     |-------------------|     |-------------------|     |-------------------|
| Coleta de dados   | --> | Avaliacao de      | --> | Traducao dos      | --> | Organizacao por   | --> | Apresentacao ao   |
| do dispositivo    |     | conformidade      |     | dados tecnicos    |     | categorias        |     | cliente           |
+-------------------+     +-------------------+     +-------------------+     +-------------------+     +-------------------+
```

### Design do Componente

- Fundo sutil com gradiente (similar ao header de relatorios)
- 5 caixas conectadas por setas
- Cada caixa com:
  - Icone representativo
  - Titulo da etapa
  - Breve descricao
- Cores consistentes com a identidade visual do sistema
- Responsivo: em mobile, as caixas empilham verticalmente

### Estrutura das Etapas

1. **Blueprints** (icone: FileCode)
   - "Define os steps de coleta de dados do dispositivo"
   
2. **Regras** (icone: CheckCircle)
   - "Avalia os dados coletados contra criterios de conformidade"
   
3. **Parses** (icone: Code2)
   - "Traduz termos tecnicos para linguagem amigavel"
   
4. **Fluxo de Analise** (icone: Workflow)
   - "Organiza regras em categorias para o relatorio"
   
5. **Visualizacao** (icone: Settings)
   - "Define ordem e aparencia das categorias no relatorio"

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/data/mockCompliance.ts` | Remover arquivo (codigo morto) |
| `src/components/admin/TemplatePipelineFlow.tsx` | Criar novo componente |
| `src/pages/admin/TemplatesPage.tsx` | Adicionar componente entre titulo e tabela |

---

## Implementacao Tecnica

### 1. Remover mockCompliance.ts

Simplesmente deletar o arquivo, pois nao e utilizado.

### 2. Criar TemplatePipelineFlow.tsx

```tsx
// Componente visual com 5 etapas conectadas
// Usa icones do Lucide
// Gradiente de fundo similar aos headers de relatorio
// Setas SVG entre as etapas
// Layout flex com gap apropriado
// Responsivo com wrap em mobile
```

### 3. Integrar na TemplatesPage

Inserir o componente entre:
- "Gerencie os templates de dispositivos disponiveis no sistema"
- A tabela de templates

---

## Beneficios

1. **Educacional**: Administradores entendem o pipeline completo
2. **Navegacao**: Cada etapa pode ser clicavel para ir a aba correspondente
3. **Consistencia visual**: Usa a mesma linguagem de design do sistema
4. **Orientacao**: Novo administradores entendem rapidamente a arquitetura

