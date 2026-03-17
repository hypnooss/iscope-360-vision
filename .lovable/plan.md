

## Plano: Glass no footer + remover botão do header

### 1. Footer — glass effect (`src/pages/Index.tsx`, linha 481)

Alterar de:
```
<footer className="relative z-10 border-t border-border/20">
```
Para:
```
<footer className="relative z-10 border-t border-border/20 bg-background/40 backdrop-blur-xl">
```

### 2. Header — remover botão "Acessar Plataforma" (`src/components/Header.tsx`)

- Remover o bloco `<div className="hidden md:block shrink-0">` com o `<Button>` (linhas 61-70)
- Remover o `<Button>` do menu mobile também (linha ~99)
- Remover imports não usados: `LogIn`, `useNavigate`, `Button`

### Arquivos alterados
1. `src/pages/Index.tsx` — glass no footer
2. `src/components/Header.tsx` — remover botão CTA desktop e mobile

