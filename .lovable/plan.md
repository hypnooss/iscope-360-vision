

## Reorganize Firewall Security Insight card layout to 3-line format

The current card layout in `SecurityInsightCard.tsx` has the title + category text on top, then all badges mixed in a single wrapped row. The user wants a clear 3-line structure matching the asset cards in "Detalhamento da Exposição":

```text
Line 1: [Icon] Insight title                              [dot]
Line 2: [Category badge] [Metadata/info badges...]
Line 3: [Severity badge]
```

### Change

**`src/components/m365/shared/SecurityInsightCard.tsx`** (lines ~132-238)

Restructure the card interior:

1. **Line 1 (Header)**: Keep icon + title + DataSourceDot. Remove the category text span below the title (line 155-158).

2. **Line 2 (Info badges)**: Render category badge first, then metadata badges (occurrences, affected users, compliance correlation, trend, numeric metadata). This becomes the "context" row.

3. **Line 3 (Severity)**: Render only the severity/OK/N/A badge on its own row at the bottom.

The card structure changes from `CardHeader + CardContent` to a simpler layout with 3 distinct visual rows inside the card, keeping the same `border-l-4` and click behavior.

