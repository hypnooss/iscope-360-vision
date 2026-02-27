

## Changes to `/settings` page

### 1. Reorder tabs alphabetically
Current order: `Chaves de API`, `Módulos`, `Agents`
New order: `Agents`, `Chaves de API`, `Módulos`

Also update `defaultValue`/initial `activeTab` from `"api-keys"` to `"agents"` (first tab alphabetically).

### 2. Swap cards in the Agents tab
Move "Gerenciamento de Atualizações" card (lines 732-1034) above "Configurações dos Agents" card (lines 673-730).

### 3. Remove icon from "Gerenciamento de Atualizações"
Remove the `<Upload className="w-5 h-5" />` element from the card title (line 738).

### Technical details
- File: `src/pages/admin/SettingsPage.tsx`
- Tab order change: reorder the three `<TabsTrigger>` elements at lines 560-571
- Card swap: move the entire Card block at lines 732-1034 before the Card block at lines 673-730
- Icon removal: delete `<Upload className="w-5 h-5" />` from line 738

