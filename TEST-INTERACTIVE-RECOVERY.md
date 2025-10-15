# Testing Interactive Error Recovery

This guide will help you test the interactive error recovery features by intentionally triggering failures.

## Prerequisites

1. Make sure your bot is configured in `.env`
2. Ensure you have access to the Telegram bot
3. Build the project: `npm run build`

## Test Scenarios

### Test 1: Unknown Merchant Correction

This test simulates a scenario where the bot extracts the amount correctly but can't identify the merchant name.

**Run the test:**
```bash
npm run test:recovery:merchant
```

**Expected Flow:**
1. Send any photo to your Telegram bot
2. Bot will respond: "❌ I couldn't identify the merchant name from your receipt."
3. Bot shows: Amount: MYR 16.00, Merchant: Unknown Merchant
4. Bot asks: "📝 Please reply with the correct merchant name, or /cancel to start over."
5. **You reply:** `TONG PEI LU` (or any merchant name)
6. Bot responds: "✅ Merchant updated to: TONG PEI LU"
7. Bot categorizes and stores the transaction
8. Bot sends confirmation with the corrected merchant name

**What to verify:**
- ✅ Bot correctly identifies the issue (unknown merchant)
- ✅ Bot asks for correction in a clear way
- ✅ Your text input is processed correctly
- ✅ Transaction is categorized with the corrected merchant name
- ✅ Final confirmation shows the correct merchant name

---

### Test 2: Amount Correction

This test simulates a scenario where the bot extracts the merchant correctly but gets amount as 0.

**Run the test:**
```bash
npm run test:recovery:amount
```

**Expected Flow:**
1. Send any photo to your Telegram bot
2. Bot will respond: "❌ I couldn't extract the amount from your receipt."
3. Bot shows: Merchant: Test Merchant, Amount: MYR 0.00
4. Bot asks: "📝 Please reply with the correct amount (e.g., '16.50'), or /cancel to start over."
5. **You reply:** `16.50` (or any amount)
6. Bot responds: "✅ Amount updated to: MYR 16.50"
7. Bot categorizes and stores the transaction
8. Bot sends confirmation with the corrected amount

**What to verify:**
- ✅ Bot correctly identifies the issue (zero amount)
- ✅ Bot asks for correction with example format
- ✅ Your amount input is parsed correctly (handles "16.50", "16", "MYR 16.50", etc.)
- ✅ Transaction is stored with the corrected amount
- ✅ Final confirmation shows the correct amount

---

### Test 3: Full Extraction Failure (Manual Entry)

This test simulates a complete extraction failure where the bot can't extract any data.

**Run the test:**
```bash
npm run test:recovery:extraction
```

**Expected Flow:**
1. Send any photo to your Telegram bot
2. Bot will respond: "❌ Failed to extract transaction data from image"
3. Bot asks: "💡 What would you like to do?"
   - 1️⃣ Send a clearer photo of the receipt
   - 2️⃣ Type the transaction details manually (reply with merchant name)
   - 3️⃣ /cancel to start over
4. **You reply:** `TONG PEI LU` (merchant name)
5. Bot responds: "✅ Got it! Merchant: TONG PEI LU"
6. Bot asks: "📝 Now please reply with the amount (e.g., '16.50')"
7. **You reply:** `16.50` (amount)
8. Bot responds: "✅ Amount updated to: MYR 16.50"
9. Bot categorizes and stores the transaction
10. Bot sends confirmation with both corrected values

**What to verify:**
- ✅ Bot handles complete extraction failure gracefully
- ✅ Bot offers multiple recovery options
- ✅ Two-step manual entry works (merchant → amount)
- ✅ Transaction is stored with manually entered data
- ✅ Final confirmation shows all correct values

---

## Additional Tests

### Test Cancel Command

At any point during the correction flow:
1. Type `/cancel`
2. Bot should respond: "✅ Cancelled. You can send a new receipt or photo."
3. Pending workflow should be cleared

### Test Invalid Input

**For amount correction:**
1. Trigger amount correction test
2. Reply with invalid input: `abc` or `not a number`
3. Bot should respond: "❌ Invalid amount. Please enter a valid number (e.g., '16.50')."
4. Workflow should remain pending (you can try again)

### Test Multiple Users

1. Run the test
2. Have two different Telegram users send photos simultaneously
3. Each user should have their own independent correction flow
4. Corrections from one user shouldn't affect the other

---

## Troubleshooting

### Bot doesn't respond to text input
- Check that the bot is running (you should see logs)
- Verify you're sending text, not a command (commands start with `/`)
- Check logs for any errors

### Bot asks for correction but I want to cancel
- Send `/cancel` command
- This will clear the pending workflow

### Test mode not working
- Make sure you're using the correct command
- Check that the test script is running (not the regular app)
- Look for "🧪 TEST MODE ACTIVE" in the logs

### Want to test with real extraction
- Stop the test script (Ctrl+C)
- Run the regular app: `npm run dev`
- Send a real receipt photo

---

## Understanding the Logs

When running tests, you'll see detailed logs:

```
🧪 TEST MODE ACTIVE
📋 Mode: unknown_merchant

Expected behavior:
  - Bot will extract amount correctly but merchant as "Unknown Merchant"
  - Bot will ask you to provide the correct merchant name
  - Reply with the merchant name to continue
```

Look for these key log messages:
- `📸 Processing photo for user...` - Photo received
- `❌ Workflow error` - Error detected
- `Processing user text input` - Your correction received
- `✅ Merchant updated to:` - Correction applied
- `Transaction categorized after merchant correction` - Success!

---

## Next Steps

After testing all scenarios:

1. **Review the logs** - Check that reasoning is included in categorization
2. **Check the database** - Verify transactions are stored correctly
3. **Test with real photos** - Run the regular app and send actual receipts
4. **Monitor production** - Watch for real-world correction scenarios

---

## Quick Reference

```bash
# Test unknown merchant correction
npm run test:recovery:merchant

# Test amount correction
npm run test:recovery:amount

# Test full extraction failure
npm run test:recovery:extraction

# Stop any test
Ctrl+C

# Run regular app
npm run dev
```

---

## Success Criteria

✅ All three test scenarios complete successfully  
✅ Bot asks for corrections in clear, user-friendly language  
✅ User input is processed correctly  
✅ Transactions are stored with corrected data  
✅ Categorization includes reasoning  
✅ /cancel command works at any point  
✅ Invalid input is handled gracefully  
✅ Multiple users can use the bot simultaneously  

If all criteria are met, the interactive error recovery is working correctly! 🎉
