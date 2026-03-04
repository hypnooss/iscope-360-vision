

## Fix `user.local` and `firewall.addrgrp` Formatting

### Problems

1. **`user.local`**: Content is `status[disable->enable]` — standard `field[old->new]` format. But it's routed to `parseUserFormat` which doesn't detect `->` arrows, so it shows raw text without color-coding.

2. **`firewall.addrgrp`**: Content is `member[agn:43.152.36.182->agn:0.0.0.0]` — standard `field[old->new]` diff format. But `parseAddrgrpFormat` strips brackets and tokenizes, producing broken output like `member[agn:43.152.36.182->agn:0.0.0.0]` as a raw string.

### Root Cause

Both specialized parsers intercept data that actually follows the standard `field[old->new]` pattern. The fix: try `parseFieldBracketFormat` first for both paths, only fall back to the specialized parser if it doesn't match.

### Solution

**File**: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. **`user.local` / all `user.*`** (lines 262-265): Before calling `parseUserFormat`, check if cfgattr contains `field[...->...]` pattern. If yes, route to `parseFieldBracketFormat` first. Only fall back to `parseUserFormat` if bracket parse returns empty or doesn't match.

2. **`firewall.addrgrp`** (lines 272-275): Same approach — try `parseFieldBracketFormat` first. Only fall back to `parseAddrgrpFormat` if it doesn't produce results or if the content has `[NNN]:` prefix pattern.

3. **Updated dispatcher logic** (around lines 256-275):
```
// user.adgrp → standard field[value]
if (path === 'user.adgrp') { ... }

// user.* → try field[old->new] first, then user-specific
if (path.startsWith('user.')) {
  if (/\w+\[.*->.*\]/.test(cfgattr)) {
    const result = parseFieldBracketFormat(cfgattr);
    if (result.length > 0) return result;
  }
  return parseUserFormat(cfgattr);
}

// firewall.addrgrp → try field[old->new] first, then addrgrp-specific
if (path === 'firewall.addrgrp' || path === 'firewall.addrgrp6') {
  if (/\w+\[.*->.*\]/.test(cfgattr)) {
    const result = parseFieldBracketFormat(cfgattr);
    if (result.length > 0) return result;
  }
  return parseAddrgrpFormat(cfgattr);
}
```

This ensures that when the content is a standard diff (`field[old->new]`), it gets color-coded properly regardless of path, while still using specialized parsers for non-diff formats.

