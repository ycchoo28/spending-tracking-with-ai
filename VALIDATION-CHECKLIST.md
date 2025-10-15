# Validation Checklist

Use this checklist to manually validate the Receipt Tracker Agent functionality.

## Pre-Validation Setup

- [ ] Environment variables configured in `.env`
- [ ] Database migrations applied
- [ ] Dependencies installed (`npm install`)
- [ ] Application built (`npm run build`)
- [ ] Bot is running (`npm start` or `npm run dev`)

## 1. E-wallet Screenshot Testing

### DuitNow Transactions
- [ ] Send DuitNow payment confirmation screenshot to bot
- [ ] Verify bot acknowledges receipt
- [ ] Check extracted amount is correct
- [ ] Verify merchant name is identified
- [ ] Confirm payment method shows "DuitNow"
- [ ] Validate date/time extraction
- [ ] Check category assignment is appropriate
- [ ] Verify transaction stored in Supabase
- [ ] Confirm confirmation message received

**Expected Result**: Transaction correctly extracted, categorized, and stored.

### GrabPay Transactions
- [ ] Send GrabPay transaction screenshot to bot
- [ ] Verify bot acknowledges receipt
- [ ] Check extracted amount is correct
- [ ] Verify merchant name is identified
- [ ] Confirm payment method shows "GrabPay"
- [ ] Validate date/time extraction
- [ ] Check category assignment is appropriate
- [ ] Verify transaction stored in Supabase
- [ ] Confirm confirmation message received

**Expected Result**: Transaction correctly extracted, categorized, and stored.

### Touch 'n Go eWallet
- [ ] Send TNG eWallet transaction screenshot to bot
- [ ] Verify bot acknowledges receipt
- [ ] Check extracted amount is correct
- [ ] Verify merchant name is identified
- [ ] Confirm payment method shows "Touch 'n Go" or "TNG"
- [ ] Validate date/time extraction
- [ ] Check category assignment is appropriate
- [ ] Verify transaction stored in Supabase
- [ ] Confirm confirmation message received

**Expected Result**: Transaction correctly extracted, categorized, and stored.

## 2. Physical Receipt Testing

### Restaurant Receipt
- [ ] Send clear restaurant receipt photo to bot
- [ ] Verify bot acknowledges receipt
- [ ] Check total amount is correct
- [ ] Verify restaurant name is identified
- [ ] Check if individual items are extracted (if itemized)
- [ ] Validate date/time extraction
- [ ] Confirm category is "Food & Dining"
- [ ] Verify transaction stored in Supabase
- [ ] Confirm confirmation message received

**Expected Result**: Receipt correctly processed with itemization if available.

### Retail Receipt
- [ ] Send retail store receipt photo to bot
- [ ] Verify bot acknowledges receipt
- [ ] Check total amount is correct
- [ ] Verify store name is identified
- [ ] Check if products are extracted
- [ ] Validate date/time extraction
- [ ] Confirm category is "Shopping" or appropriate
- [ ] Verify transaction stored in Supabase
- [ ] Confirm confirmation message received

**Expected Result**: Receipt correctly processed with product details.

### Service Receipt
- [ ] Send service provider receipt to bot
- [ ] Verify bot acknowledges receipt
- [ ] Check amount is correct
- [ ] Verify service provider name is identified
- [ ] Validate date/time extraction
- [ ] Check category assignment is appropriate
- [ ] Verify transaction stored in Supabase
- [ ] Confirm confirmation message received

**Expected Result**: Service transaction correctly processed.

## 3. Edge Case Testing

### Blurry Image
- [ ] Send intentionally blurry receipt image
- [ ] Verify bot attempts to process
- [ ] Check if low confidence is detected
- [ ] Confirm bot requests clearer image
- [ ] Verify error message is user-friendly

**Expected Result**: Bot gracefully handles poor quality and requests better image.

### Partial Receipt
- [ ] Send photo of partially visible receipt
- [ ] Verify bot attempts extraction
- [ ] Check if missing data is detected
- [ ] Confirm bot requests clarification or better image
- [ ] Verify no corrupt data is stored

**Expected Result**: Bot detects incomplete data and requests clarification.

### Foreign Currency
- [ ] Send receipt with non-MYR currency (USD, SGD, etc.)
- [ ] Verify bot acknowledges receipt
- [ ] Check currency code is correctly extracted
- [ ] Verify amount is correct
- [ ] Confirm transaction stored with correct currency
- [ ] Check display shows correct currency symbol

**Expected Result**: Foreign currency handled correctly.

### Very Large Amount
- [ ] Send receipt with large amount (>1000)
- [ ] Verify bot processes correctly
- [ ] Check amount precision (decimal places)
- [ ] Confirm no overflow or truncation
- [ ] Verify storage in database is accurate

**Expected Result**: Large amounts handled without precision loss.

### Very Small Amount
- [ ] Send receipt with small amount (<1)
- [ ] Verify bot processes correctly
- [ ] Check decimal precision maintained
- [ ] Confirm storage is accurate

**Expected Result**: Small amounts handled with proper precision.

## 4. Categorization Testing

### High Confidence Categorization
- [ ] Send receipt from well-known merchant (e.g., McDonald's)
- [ ] Verify automatic category assignment
- [ ] Confirm no clarification requested
- [ ] Check category is appropriate
- [ ] Verify confidence score is high (>0.8)

**Expected Result**: Automatic categorization without user input.

### Low Confidence Categorization
- [ ] Send receipt from ambiguous merchant
- [ ] Verify bot requests category clarification
- [ ] Check suggested categories are provided
- [ ] Select a category from options
- [ ] Confirm transaction stored with selected category
- [ ] Verify bot learns from selection

**Expected Result**: Bot requests clarification and learns from user input.

### Category Learning
- [ ] Send receipt from same merchant twice
- [ ] First time: manually select category
- [ ] Second time: verify automatic assignment
- [ ] Confirm bot learned from previous selection

**Expected Result**: Bot learns and improves categorization over time.

## 5. Telegram Bot Commands

### /start Command
- [ ] Send `/start` command to bot
- [ ] Verify welcome message received
- [ ] Check message explains bot functionality
- [ ] Confirm message is user-friendly

**Expected Result**: Clear welcome message with instructions.

### /help Command
- [ ] Send `/help` command to bot
- [ ] Verify help message received
- [ ] Check usage instructions are clear
- [ ] Confirm examples are provided
- [ ] Verify command list is complete

**Expected Result**: Comprehensive help information.

### /stats Command
- [ ] Ensure some transactions exist for your user
- [ ] Send `/stats` command to bot
- [ ] Verify spending summary received
- [ ] Check total spending is accurate
- [ ] Confirm transaction count is correct
- [ ] Verify category breakdown is shown
- [ ] Check date range is appropriate
- [ ] Validate currency display

**Expected Result**: Accurate spending statistics displayed.

## 6. Stats Command Accuracy

### Manual Verification
- [ ] Note down 5 transactions you've sent
- [ ] Calculate total manually
- [ ] Calculate category totals manually
- [ ] Send `/stats` command
- [ ] Compare bot's totals with your calculations
- [ ] Verify all amounts match

**Expected Result**: Stats match manual calculations exactly.

### Database Verification
- [ ] Access Supabase dashboard
- [ ] Query transactions table for your user
- [ ] Count total transactions
- [ ] Sum amounts by category
- [ ] Compare with `/stats` output
- [ ] Verify all data matches

**Expected Result**: Stats match database queries exactly.

## 7. Concurrent User Testing

### Multiple Users Simultaneously
- [ ] Have 2-3 people send receipts at the same time
- [ ] Verify each user receives acknowledgment
- [ ] Check each transaction is processed
- [ ] Confirm no data mixing between users
- [ ] Verify each user's stats are isolated
- [ ] Check database for data integrity

**Expected Result**: All users handled correctly without interference.

## 8. Error Handling

### Invalid Image Format
- [ ] Send non-image file to bot
- [ ] Verify error message received
- [ ] Check message explains issue
- [ ] Confirm bot remains functional

**Expected Result**: Graceful error handling with helpful message.

### Network Issues
- [ ] Simulate network interruption (if possible)
- [ ] Verify bot handles timeout gracefully
- [ ] Check retry mechanism works
- [ ] Confirm user is notified if persistent

**Expected Result**: Robust error handling and recovery.

### API Rate Limits
- [ ] Send many images rapidly
- [ ] Verify rate limiting is handled
- [ ] Check queue mechanism works
- [ ] Confirm users are notified of delays

**Expected Result**: Graceful handling of rate limits.

## 9. Performance Testing

### Response Time
- [ ] Send receipt image
- [ ] Time from send to acknowledgment: _____ seconds
- [ ] Time from send to confirmation: _____ seconds
- [ ] Verify times are acceptable (<30 seconds total)

**Expected Result**: Reasonable response times.

### Image Size Handling
- [ ] Send very large image (>5MB)
- [ ] Verify compression works
- [ ] Check processing completes
- [ ] Confirm quality is acceptable

**Expected Result**: Large images handled efficiently.

## 10. Data Persistence

### Transaction Storage
- [ ] Send receipt and note transaction ID
- [ ] Restart the bot
- [ ] Query Supabase for transaction
- [ ] Verify all data is intact
- [ ] Check timestamps are correct

**Expected Result**: Data persists correctly across restarts.

### User Preferences
- [ ] Set category for merchant
- [ ] Restart the bot
- [ ] Send receipt from same merchant
- [ ] Verify learned category is used

**Expected Result**: Learning persists across restarts.

## Validation Summary

### Critical Issues (Must Fix)
- [ ] List any critical issues found:
  1. ___________________________________
  2. ___________________________________
  3. ___________________________________

### Minor Issues (Should Fix)
- [ ] List any minor issues found:
  1. ___________________________________
  2. ___________________________________
  3. ___________________________________

### Observations
- [ ] Note any observations or improvements:
  1. ___________________________________
  2. ___________________________________
  3. ___________________________________

## Sign-off

- **Validator Name**: ___________________
- **Date**: ___________________
- **Overall Status**: ☐ Pass ☐ Pass with Issues ☐ Fail
- **Ready for Production**: ☐ Yes ☐ No

## Notes

Additional comments or observations:

_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
