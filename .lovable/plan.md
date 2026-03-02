

## Fix Applied: Missing EXO-018, EXO-019, EXO-022 Rules

### Root Causes Found

1. **EXO-018/019 (Inbound/Outbound Connectors)**: Step data was `null` in `task_step_results` (tenant has no connectors). The rawData reconstruction code skipped null data even for successful steps (`if (step.status === 'success' && step.data)`), so these rules were never evaluated.

2. **EXO-022 (Suspicious Inbox Rules)**: Used `evaluate: { type: 'check_suspicious_inbox_rules' }` in evaluation_logic, which was not handled by `evaluateAgentRule()` (only supported `array_empty`, `all_match`, `none_match`).

### Fixes Applied

1. **`agent-task-result/index.ts` - rawData reconstruction**: When `step.status === 'success'` but `step.data` is null, now treats it as `{ data: [] }` (empty array) so evaluators can produce a correct 'pass' result.

2. **`agent-task-result/index.ts` - evaluateSuspiciousInboxRules()**: Added new evaluator for EXO-022 that filters inbox rules for enabled rules with `ForwardTo`, `ForwardAsAttachmentTo`, or `RedirectTo` set, producing affected entities with mailbox owner details.

### Expected Result

Next M365 posture analysis should produce 3 additional cards in "Email & Exchange":
- EXO-018: Pass/Fail based on inbound connectors with TreatMessagesAsInternal
- EXO-019: Pass/Fail based on outbound connectors TLS settings
- EXO-022: Pass/Warn/Fail based on suspicious forwarding rules
