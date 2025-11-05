# Testing Guide for v2 Agent Loop

This guide covers testing the v2 multi-turn conversation system with adaptive decision-making.

## Quick Start

### 1. Test Configuration
```bash
npx tsx test-config.ts
```

Verifies all environment variables are set correctly, including v2-specific config.

### 2. Test Agent Loop
```bash
npx tsx test-agent-loop-v2.ts
```

Tests the core v2 agent loop functionality:
- Intent analysis (transaction, general, command)
- Sub-agent routing
- Command handling
- Conversation history persistence

## Test Scenarios

### Scenario 1: Happy Path (High Quality Receipt)

**Setup:**
1. Start local Supabase: `supabase start`
2. Run the app: `npm run dev`
3. Open Telegram and send a clear receipt image

**Expected Flow:**
```
User: [Sends receipt image]
Bot: ✅ Transaction saved!
     🏪 Starbucks
     💰 MYR 15.50
     📁 Food & Dining
     🆔 [transaction-id]
```

**What's Tested:**
- Image extraction with high confidence
- Automatic categorization (confidence > 0.8)
- Direct storage without user clarification
- Single-turn completion

---

### Scenario 2: Low Confidence Category

**Setup:**
1. Send a receipt from an uncommon merchant
2. Or manually trigger by using a merchant with no history

**Expected Flow:**
```
User: [Sends receipt from "Bob's Hardware"]
Bot: 📁 Please select a category for this transaction:
     💰 Amount: MYR 45.00
     🏪 Merchant: Bob's Hardware
     
     Suggested categories:
     1. Shopping
     2. Home & Garden
     3. Other
     
User: [Selects "Home & Garden"]
Bot: ✅ Transaction saved!
     🏪 Bob's Hardware
     💰 MYR 45.00
     📁 Home & Garden
     🆔 [transaction-id]
```

**What's Tested:**
- Extraction successful
- Categorization confidence < 0.8
- Agent decides to request category
- User selection processed
- Transaction stored with user's choice

---

### Scenario 3: Missing Merchant (Multi-Turn)

**Setup:**
1. Send a blurry receipt where merchant is unclear
2. Or use test mode (see below)

**Expected Flow:**
```
User: [Sends blurry receipt]
Bot: 🏪 I couldn't identify the merchant name clearly.
     💰 Amount: MYR 16.00
     
     Could you tell me the merchant name?
     
User: Starbucks
Bot: [Analyzes intent → transaction]
     [Applies context: merchant = "Starbucks"]
     [Validates → all valid]
     [Categorizes → Food & Dining]
     ✅ Transaction saved!
     🏪 Starbucks
     💰 MYR 16.00
     📁 Food & Dining
     🆔 [transaction-id]
```

**What's Tested:**
- Agent detects missing merchant
- Agent decides to request merchant
- Conversation continues (multi-turn)
- User context applied correctly
- Transaction completes after clarification

---

### Scenario 4: Error Handling (Database Failure)

**Setup:**
1. Stop Supabase: `supabase stop`
2. Send a receipt image
3. Observe error handling

**Expected Flow:**
```
User: [Sends receipt]
Bot: [Extracts data successfully]
     [Validates successfully]
     [Categorizes successfully]
     [Attempts to store → timeout]
     ❌ Failed to save transaction. Please try again.
     
[Conversation ends - no infinite loop]
```

**What's Tested:**
- Error detection in store_transaction node
- `activeSubAgent` cleared on error (v2.1 fix)
- No infinite loop
- User-friendly error message
- Conversation terminates cleanly

---

### Scenario 5: Command Handling

**Test Cancel:**
```
User: [Sends receipt]
Bot: 🏪 I couldn't identify the merchant name clearly...
User: cancel
Bot: ❌ Cancelled. How else can I help you?
```

**Test Help:**
```
User: help
Bot: 👋 Welcome to your financial assistant!
     
     I can help you:
     • Process receipt images
     • Track your expenses
     • Categorize transactions
     ...
```

**Test Status:**
```
User: status
Bot: 📊 Conversation Status
     Turn count: 3
     Active agent: none
     Created: [timestamp]
```

**What's Tested:**
- Command detection at any point
- Cancel clears active sub-agent
- Help provides contextual guidance
- Status shows conversation state

---

## Manual Testing with Telegram

### Prerequisites
1. Configure Telegram bot token in `.env`
2. Start local Supabase: `supabase start`
3. Run the app: `npm run dev`

### Test Checklist

- [ ] Send clear receipt → Single-turn success
- [ ] Send blurry receipt → Multi-turn clarification
- [ ] Send receipt from new merchant → Category selection
- [ ] Type "help" → Help message
- [ ] Type "cancel" during processing → Cancellation
- [ ] Type "status" → Status message
- [ ] Send general message → Conversational response
- [ ] Send multiple messages quickly → Context injection
- [ ] Stop Supabase mid-processing → Error handling

---

## Debugging with LangSmith

### Enable Tracing

Add to `.env`:
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_your_key_here
LANGCHAIN_PROJECT=receipt-tracker-agent
```

### View Traces

1. Go to https://smith.langchain.com
2. Select your project
3. View recent runs
4. Click on a run to see:
   - All agent steps
   - LLM calls and responses
   - Decision reasoning
   - State transitions
   - Timing information

### Useful Trace Filters

- Filter by status: `success`, `error`
- Filter by run type: `chain`, `llm`
- Search by conversation ID
- Sort by duration to find slow operations

---

## Common Issues

### Issue: "Failed to save transaction" after 300+ seconds

**Cause:** Local Supabase not running

**Fix:**
```bash
supabase start
```

**Verify:**
```bash
curl http://127.0.0.1:54321/rest/v1/
```

---

### Issue: Agent loops infinitely after error

**Cause:** Old version without v2.1 fix

**Fix:** Update to v2.1+ which clears `activeSubAgent` on errors

**Verify:** Check `src/features/receipt-processing/main-agent/nodes.ts`:
```typescript
const shouldKeepActive = !result.completed && !result.error;
```

---

### Issue: Context not applied

**Cause:** `injectedContext` not cleared after processing

**Fix:** Ensure `analyzeIntentNode` clears `injectedContext`:
```typescript
return { 
  currentIntent: intent,
  injectedContext: [], // Clear after processing
};
```

---

### Issue: Intent always detected as "general"

**Cause:** Image marker not added to message

**Fix:** Ensure orchestrator adds `[IMAGE]` marker:
```typescript
const messageWithImageMarker = message.imageData 
  ? `[IMAGE] ${message.content}`.trim()
  : message.content;
```

---

## Performance Benchmarks

Target latencies (from LangSmith traces):

| Operation | Target | Acceptable | Slow |
|-----------|--------|------------|------|
| Intent analysis | < 2s | < 5s | > 5s |
| Image extraction | < 5s | < 10s | > 10s |
| Agent decision | < 2s | < 5s | > 5s |
| Categorization | < 3s | < 8s | > 8s |
| Transaction storage | < 1s | < 3s | > 3s |
| **End-to-end** | **< 15s** | **< 30s** | **> 30s** |

---

## Automated Testing (Future)

### Unit Tests (TODO)
- Test individual node functions
- Mock LLM responses
- Test state transitions
- Test error handling

### Integration Tests (TODO)
- Test complete agent flows
- Test checkpoint persistence
- Test conversation expiration
- Test concurrent users

### E2E Tests (TODO)
- Test with real Telegram bot
- Test with real images
- Test multi-turn scenarios
- Test error recovery

---

## Test Data

### Sample Merchants
- Starbucks (Food & Dining)
- Shell (Transportation)
- IKEA (Shopping)
- Netflix (Entertainment)
- TNB (Bills & Utilities)

### Sample Amounts
- Small: 5.00 - 20.00
- Medium: 20.00 - 100.00
- Large: 100.00 - 500.00

### Sample Scenarios
- Clear receipt with all data
- Blurry receipt (missing merchant)
- Receipt with unclear amount
- E-wallet screenshot
- Physical receipt photo
- Receipt in different languages

---

## Success Criteria

✅ All test scenarios complete successfully  
✅ No infinite loops on errors  
✅ Multi-turn conversations work smoothly  
✅ Context injection works correctly  
✅ Commands work at any point  
✅ Error messages are user-friendly  
✅ Performance meets targets  
✅ LangSmith traces show correct flow  
✅ Database stores transactions correctly  
✅ Conversation history persists  

---

## Next Steps

After completing all tests:

1. **Review LangSmith traces** - Check decision reasoning quality
2. **Monitor performance** - Identify slow operations
3. **Test edge cases** - Unusual inputs, network failures
4. **Load testing** - Multiple concurrent users
5. **Production deployment** - Monitor real-world usage

---

## Quick Reference

```bash
# Test configuration
npx tsx test-config.ts

# Test agent loop
npx tsx test-agent-loop-v2.ts

# Run application
npm run dev

# Start Supabase
supabase start

# Check Supabase status
supabase status

# View Supabase logs
supabase logs

# Stop Supabase
supabase stop
```

---

## Deprecated Tests

The following test files are for v1 and are **no longer compatible**:

- ❌ `test-console-adapter.ts` - Uses v1 callbacks
- ❌ `test-interactive-recovery.ts` - Uses v1 workflow
- ❌ `TEST-INTERACTIVE-RECOVERY.md` - v1 testing guide

These files are kept for reference but should not be used for v2 testing.
