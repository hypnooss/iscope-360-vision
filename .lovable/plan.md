

## Plan: Auto-advance on device type selection in AddFirewallPage

### `src/pages/environment/AddFirewallPage.tsx`

1. **Line 520** — Change the `onClick` handler of device type buttons from `setSelectedDeviceTypeId(dt.id)` to `{ setSelectedDeviceTypeId(dt.id); setStep(2); }` so selecting a device type immediately advances to step 2.

2. **Lines 549-552** — Remove the "Próximo" button from the step 1 footer, keeping only the "Voltar" button.

