
# Corrigir posicionamento dos tooltips de tipo de breach

## Problema

O tooltip Radix nao consegue calcular a posicao correta porque o `TooltipTrigger` com `asChild` esta sendo aplicado diretamente no `Badge` dentro de uma celula de tabela (`td`). O Radix Popper calcula `transform: translate(0px, -200%)`, jogando o balao para fora da tela.

## Solucao

**Arquivo**: `src/components/external-domain/LeakedCredentialsSection.tsx`

Envolver o `Badge` em um `<span>` inline com `display: inline-flex` e usar esse `<span>` como trigger do tooltip. Isso garante que o Radix consiga medir corretamente as dimensoes e posicao do elemento trigger dentro da tabela.

Alteracao na celula do tipo (linhas 545-557):

```text
<td className="px-3 py-2">
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex cursor-help">
        <Badge variant="outline" className={cn("text-[10px] px-1.5 gap-1", bt.className)}>
          <BtIcon className="w-3 h-3" />
          {bt.label}
        </Badge>
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs">
      {bt.tooltip}
    </TooltipContent>
  </Tooltip>
</td>
```

Isso resolve tanto o posicionamento incorreto do balao quanto o hover que nao funciona diretamente na badge.
