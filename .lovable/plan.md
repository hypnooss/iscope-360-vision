

## Problem

The Firewall Analyzer fullscreen map shows a gap at the top where the system background/navigation is visible, while the Entra ID fullscreen map correctly covers the entire screen.

Both components use `fixed inset-0` positioning but the Firewall version (`AttackMapFullscreen`) uses `z-[9999]` while the Entra ID version uses `z-50`. The issue is likely caused by a parent element (sidebar or layout container) creating a stacking context that prevents the fullscreen overlay from properly covering everything.

## Solution

Use a **React Portal** (`ReactDOM.createPortal`) in `AttackMapFullscreen.tsx` to render the fullscreen overlay directly onto `document.body`, bypassing any parent stacking contexts. This is a minimal, isolated change that won't affect the map itself or any other component.

### File: `src/components/firewall/AttackMapFullscreen.tsx`

- Import `createPortal` from `react-dom`
- Wrap the entire returned JSX in `createPortal(..., document.body)`
- Keep everything else exactly the same (z-index, styles, children)

This is the same technique commonly used for modals and ensures the overlay escapes any CSS stacking context created by the sidebar or layout wrappers.

