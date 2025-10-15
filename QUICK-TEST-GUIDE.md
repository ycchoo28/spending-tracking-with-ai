# Quick Test Guide - Interactive Error Recovery

## 🚀 Quick Start (3 Steps)

### Step 1: Build the project
```bash
npm run build
```

### Step 2: Choose a test scenario
```bash
# Test 1: Unknown merchant correction
npm run test:recovery:merchant

# Test 2: Amount correction  
npm run test:recovery:amount

# Test 3: Full extraction failure
npm run test:recovery:extraction
```

### Step 3: Test via Telegram
1. Open your Telegram bot
2. Send **any photo** (doesn't matter what it is)
3. Bot will simulate the error and ask for correction
4. Reply with the requested information
5. Verify the transaction is stored correctly

---

## 📱 What to Send

### Test 1: Unknown Merchant
```
You send: [any photo]
Bot asks: "Please reply with the correct merchant name"
You reply: TONG PEI LU
Bot: ✅ Transaction recorded!
```

### Test 2: Amount Correction
```
You send: [any photo]
Bot asks: "Please reply with the correct amount"
You reply: 16.50
Bot: ✅ Transaction recorded!
```

### Test 3: Full Manual Entry
```
You send: [any photo]
Bot asks: "Type details manually (reply with merchant name)"
You reply: TONG PEI LU
Bot asks: "Now please reply with the amount"
You reply: 16.50
Bot: ✅ Transaction recorded!
```

---

## ✅ Success Indicators

Look for these in the bot responses:
- ✅ "Merchant updated to: [your input]"
- ✅ "Amount updated to: MYR [your input]"
- ✅ "Transaction recorded successfully!"
- ✅ Final confirmation shows your corrected values

Look for these in the logs:
- `🧪 TEST MODE ACTIVE`
- `Processing user text input`
- `Transaction categorized after [merchant/amount] correction`
- `💡 Reasoning: [explanation]`

---

## 🛑 Stop Testing

Press `Ctrl+C` to stop the test bot

---

## 📖 Full Documentation

- **Detailed Testing Guide**: `TEST-INTERACTIVE-RECOVERY.md`
- **Flow Diagrams**: `docs/guides/interactive-recovery-flow.md`
- **Implementation Summary**: `docs/summaries/INTERACTIVE-ERROR-RECOVERY.md`

---

## 🐛 Troubleshooting

**Bot doesn't respond?**
- Check the logs for errors
- Verify your .env file has correct TELEGRAM_BOT_TOKEN

**Want to cancel?**
- Send `/cancel` command in Telegram

**Want to test with real extraction?**
- Stop the test (Ctrl+C)
- Run: `npm run dev`
- Send a real receipt photo

---

## 🎯 Expected Results

After successful testing, you should see:
1. Bot correctly identifies the error type
2. Bot asks for correction in clear language
3. Your input is processed correctly
4. Transaction is stored with corrected data
5. Categorization includes reasoning
6. Final confirmation shows all correct values

That's it! Happy testing! 🎉
