

## Plano: Expandir seletor de fuso horário com fusos mundiais

### Mudanças

**`src/pages/AccountPage.tsx`** (linhas 170-179): Substituir a lista atual de 8 fusos brasileiros por uma lista completa dos principais fusos mundiais, ordenados de UTC+12 até UTC-12, com UTC como valor padrão.

**`src/pages/AccountPage.tsx`** (linha 46): Alterar o default de `'America/Sao_Paulo'` para `'UTC'`.

**`src/contexts/AuthContext.tsx`**: Alterar o default de timezone para `'UTC'` onde aplicável.

**Migration SQL**: Alterar o DEFAULT da coluna `timezone` na tabela `profiles` de `'America/Sao_Paulo'` para `'UTC'`.

### Lista de fusos (ordenada +12 → -12)

| Offset | Label | IANA Value |
|--------|-------|------------|
| UTC+12 | Auckland (UTC+12) | Pacific/Auckland |
| UTC+11 | Solomon Islands (UTC+11) | Pacific/Guadalcanal |
| UTC+10 | Sydney (UTC+10) | Australia/Sydney |
| UTC+9:30 | Adelaide (UTC+9:30) | Australia/Adelaide |
| UTC+9 | Tokyo (UTC+9) | Asia/Tokyo |
| UTC+8 | Singapore (UTC+8) | Asia/Singapore |
| UTC+7 | Bangkok (UTC+7) | Asia/Bangkok |
| UTC+6 | Dhaka (UTC+6) | Asia/Dhaka |
| UTC+5:30 | Mumbai (UTC+5:30) | Asia/Kolkata |
| UTC+5 | Karachi (UTC+5) | Asia/Karachi |
| UTC+4 | Dubai (UTC+4) | Asia/Dubai |
| UTC+3 | Moscou (UTC+3) | Europe/Moscow |
| UTC+2 | Cairo (UTC+2) | Africa/Cairo |
| UTC+1 | Paris / Berlim (UTC+1) | Europe/Paris |
| UTC | UTC | UTC |
| UTC-1 | Açores (UTC-1) | Atlantic/Azores |
| UTC-2 | Fernando de Noronha (UTC-2) | America/Noronha |
| UTC-3 | Brasília (UTC-3) | America/Sao_Paulo |
| UTC-4 | Manaus / Santiago (UTC-4) | America/Manaus |
| UTC-5 | Nova York / Lima (UTC-5) | America/New_York |
| UTC-6 | Chicago / Cidade do México (UTC-6) | America/Chicago |
| UTC-7 | Denver (UTC-7) | America/Denver |
| UTC-8 | Los Angeles (UTC-8) | America/Los_Angeles |
| UTC-9 | Anchorage (UTC-9) | America/Anchorage |
| UTC-10 | Honolulu (UTC-10) | Pacific/Honolulu |
| UTC-11 | Samoa (UTC-11) | Pacific/Pago_Pago |
| UTC-12 | Baker Island (UTC-12) | Etc/GMT+12 |

### Impacto
- 1 arquivo editado: `AccountPage.tsx`
- 1 migration para alterar o DEFAULT da coluna
- Atualização do AuthContext para refletir o novo default

