

## Investigation: Missing EXO Rules and Agent Performance

### Status
- The progress bar IS working correctly (screenshot confirms it)
- Record `f1762042` is `completed` with score 74, 68 total insights (54 Graph + 14 Agent)

### Problem: 3 Missing EXO Rules

EXO-018, EXO-019, EXO-022 are not appearing in results despite the agent collecting the relevant data (`exo_inbound_connectors`, `exo_outbound_connectors`, `exo_inbox_rules`). This suggests a mismatch between the `source_key` in those rules' `evaluation_logic` and the keys in the raw data sent by the agent.

### Proposed Fix

1. **Investigate** the `evaluation_logic.source_key` for EXO-018, EXO-019, EXO-022 in `compliance_rules` and compare against the actual keys in the agent's raw data
2. **Fix** any `source_key` mismatches so these rules produce insights
3. This would add 3 more cards to Email & Exchange

### About the 700s Execution Time

This is expected behavior — the PowerShell CBA session requires:
- Certificate-based auth handshake (~30s)
- Sequential execution of 23 Exchange commands
- Some commands like `exo_inbox_rules` and `exo_message_trace` iterate across all mailboxes

The number of cards (14) is correct for the current EXO rule set. The 73 `source_key` rules in the DB include rules from ALL categories (ADM, AUT, IDT, etc.) which are already evaluated by the Graph API, not by the agent.

### Next Step

Investigate and fix the 3 missing EXO rules' `source_key` mapping to increase coverage.

