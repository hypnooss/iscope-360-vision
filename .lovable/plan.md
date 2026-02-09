

# Fix: Always show rule description (criteria) on Exchange Online cards

## Root Cause

In `mapExchangeAgentInsight`, the mapper sets `passDescription`, `failDescription`, and `notFoundDescription` to the dynamic analysis results. The `UnifiedComplianceCard` uses these as the contextual message (the text shown below the rule name), which **overrides** the criteria ("Verifica se...").

In contrast, the Domain/Firewall mapper (`mapComplianceCheck`) never sets these fields, so the card always falls back to `description` (the criteria) for the contextual message.

## Fix

In `src/lib/complianceMappers.ts`, remove the `passDescription`, `failDescription`, and `notFoundDescription` mappings from `mapExchangeAgentInsight`. This way:

- The contextual message will ALWAYS show the criteria ("Verifica se...") regardless of status - just like Domain and Firewall
- The dynamic analysis result stays in `details` and appears in the "ANALISE EFETUADA" expandable section

### Before (current mapper, lines 249-251):
```
failDescription: insight.failDescription || insight.description,
passDescription: insight.passDescription,
notFoundDescription: insight.notFoundDescription,
```

### After:
```
// Remove passDescription, failDescription, notFoundDescription
// Let UnifiedComplianceCard fall back to description (criteria)
```

## File changed

| File | Change |
|------|--------|
| `src/lib/complianceMappers.ts` | Remove 3 lines (passDescription, failDescription, notFoundDescription) from mapExchangeAgentInsight return |

## Result

All Exchange cards will display identically to Domain/Firewall:
- Level 1: Rule name + criteria ("Verifica se...")
- Level 3 (expanded): "ANALISE EFETUADA" shows the dynamic result
