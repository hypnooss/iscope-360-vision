

## Make "Detalhamento da Exposição" outer card invisible

The outer `<Card>` in `AssetHealthGrid` currently renders with a visible border (`border-border/50`), creating a large container box around all the asset cards. The user wants this container to be invisible — it should only serve as a layout wrapper, not a visible card.

### Change
**`src/components/surface/AssetHealthGrid.tsx`** (~line 258-259):
- Replace `<Card className="border-border/50">` with a plain `<div>`
- Replace `<CardContent className="pt-6">` with `<div className="pt-2">`
- Update corresponding closing tags

This keeps the grid layout and inner asset cards intact while removing the visible outer container.

