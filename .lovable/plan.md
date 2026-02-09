

# Remover submenu "Postura de Seguranca" do menu Microsoft 365

## Alteracao

Um unico arquivo precisa ser editado:

### `src/components/layout/AppLayout.tsx` (linha 129)

Remover a entrada do menu:
```typescript
{ label: 'Postura de Segurança', href: '/scope-m365/posture', icon: ShieldCheck },
```

As rotas e paginas relacionadas (`M365PosturePage`, `M365PostureReportPage`, etc.) serao mantidas intactas -- apenas o link no menu lateral sera removido. Caso deseje acessar a pagina futuramente, bastara navegar diretamente pela URL.

