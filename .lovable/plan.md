

# Corrigir: Aba de Configuracoes resetando ao trocar de aba

## Problema identificado

A pagina de Configuracoes (`SettingsPage`) reseta para a aba "Microsoft 365" sempre que ocorre um re-render significativo. Isso acontece por dois motivos combinados:

1. O componente `Tabs` usa `defaultValue="m365"` (modo nao-controlado). Quando o componente e desmontado e remontado, ele volta para a aba padrao.
2. A funcao `checkM365Config()` define `loading = true`, o que faz o componente inteiro ser substituido por um spinner de carregamento. Quando o loading termina, o `Tabs` e recriado do zero e volta para "m365".

## Solucao

### 1. Tornar o Tabs controlado com `useState`

Substituir `defaultValue="m365"` por um estado controlado (`activeTab`), para que a aba selecionada persista entre re-renders.

```
// Antes
<Tabs defaultValue="m365">

// Depois
const [activeTab, setActiveTab] = useState("m365");
<Tabs value={activeTab} onValueChange={setActiveTab}>
```

### 2. Separar o loading inicial do loading de atualizacao

Atualmente, `checkM365Config()` define `loading = true` sempre que e chamada. Isso causa o spinner fullscreen que desmonta tudo. A solucao e usar `loading` apenas no carregamento inicial e nao no refresh manual.

- Adicionar um parametro `isInitialLoad` na funcao `checkM365Config`
- So exibir o spinner fullscreen quando for o primeiro carregamento (`loading` inicial)
- Nos refreshes subsequentes (botao "Verificar"), usar um estado diferente (ex: `refreshing`) que nao desmonta o conteudo

### 3. (Menor) Polling de agentStats nao causa desmonte

O polling de `loadAgentStats` a cada 5s ja nao causa problemas graves porque nao altera `loading`. Mas com a correcao do item 1, fica ainda mais seguro.

## Arquivo afetado

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/admin/SettingsPage.tsx` | Tabs controlado com estado; separar loading inicial de refresh |

## Resultado esperado

- Ao trocar de aba e voltar, a aba selecionada permanece
- Ao clicar em "Verificar" na aba M365, a pagina nao reseta para a aba padrao
- O polling de 5s nao interfere na navegacao entre abas

