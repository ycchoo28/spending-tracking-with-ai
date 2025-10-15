# Interactive Error Recovery Flow

## Visual Flow Diagrams

### Flow 1: Unknown Merchant Correction

```
┌─────────────────────────────────────────────────────────────┐
│ User sends receipt photo                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "📸 Photo received! Processing your receipt..."        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Vision Extraction (Mock returns "Unknown Merchant")         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Validation: Merchant = "Unknown Merchant" ❌                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "❌ I couldn't identify the merchant name"             │
│      "💰 Amount: MYR 16.00"                                 │
│      "🏪 Merchant: Unknown Merchant"                        │
│      "📝 Please reply with the correct merchant name"       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ [Workflow paused - waiting for user input]                  │
│ Pending workflow stored in memory                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ User replies: "TONG PEI LU"                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Text handler detects pending workflow                       │
│ Type: merchant_correction                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Update extractedData.merchantName = "TONG PEI LU"          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "✅ Merchant updated to: TONG PEI LU"                  │
│      "🔄 Categorizing transaction..."                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Categorization with corrected data                          │
│ Returns: category + confidence + reasoning                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Store transaction in database                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "✅ Transaction recorded successfully!"                │
│      "💰 Amount: MYR 16.00"                                 │
│      "🏪 Merchant: TONG PEI LU"                             │
│      "📁 Category: Others"                                  │
│      "💡 Reasoning: Person-to-person transfer"              │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 2: Amount Correction

```
┌─────────────────────────────────────────────────────────────┐
│ User sends receipt photo                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Vision Extraction (Mock returns amount = 0)                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Validation: Amount = 0 ❌                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "❌ I couldn't extract the amount"                     │
│      "🏪 Merchant: Test Merchant"                           │
│      "💰 Amount: MYR 0.00"                                  │
│      "📝 Please reply with the correct amount (e.g. 16.50)" │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ User replies: "16.50"                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Parse amount: "16.50" → 16.50                               │
│ Update extractedData.amount = 16.50                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "✅ Amount updated to: MYR 16.50"                      │
│      "🔄 Categorizing transaction..."                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Continue with categorization and storage                    │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 3: Full Extraction Failure (Manual Entry)

```
┌─────────────────────────────────────────────────────────────┐
│ User sends receipt photo                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Vision Extraction throws error ❌                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "❌ Failed to extract transaction data"                │
│      "💡 What would you like to do?"                        │
│      "1️⃣ Send a clearer photo"                              │
│      "2️⃣ Type details manually"                             │
│      "3️⃣ /cancel to start over"                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ User replies: "TONG PEI LU" (merchant name)                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "✅ Got it! Merchant: TONG PEI LU"                     │
│      "📝 Now please reply with the amount (e.g. 16.50)"     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Update workflow type: retry_extraction → amount_correction  │
│ Create extractedData with merchant name                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ User replies: "16.50" (amount)                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Parse and update amount                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "✅ Amount updated to: MYR 16.50"                      │
│      "🔄 Categorizing transaction..."                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Continue with categorization and storage                    │
└─────────────────────────────────────────────────────────────┘
```

---

## State Management

### Pending Workflow Structure

```typescript
{
  userId: "123456789",
  chatId: 987654321,
  type: "merchant_correction" | "amount_correction" | "retry_extraction",
  state: WorkflowState,
  extractedData: {
    merchantName: "Unknown Merchant",
    amount: 16.00,
    currency: "MYR",
    dateTime: "2025-10-15T15:58:59Z",
    paymentMethod: "eWallet Balance",
    confidence: 0.95
  },
  errorMessage: "Merchant name is unknown",
  timestamp: 1729012739000
}
```

### Workflow State Transitions

```
┌──────────────────┐
│  No Pending      │
│  Workflow        │
└────────┬─────────┘
         │
         │ Error detected
         ▼
┌──────────────────┐
│  Pending         │
│  Workflow        │
│  Stored          │
└────────┬─────────┘
         │
         │ User sends text
         ▼
┌──────────────────┐
│  Text Handler    │
│  Processes       │
│  Input           │
└────────┬─────────┘
         │
         │ Success or /cancel
         ▼
┌──────────────────┐
│  Workflow        │
│  Cleared         │
└──────────────────┘
```

---

## Error Type Routing

```
┌─────────────────────────────────────────────────────────────┐
│ Workflow Error Detected                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         ┌───────┴───────┐
         │ Error Type?   │
         └───────┬───────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
     ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Validation│ │Extraction│ │ Other  │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Check    │ │Request  │ │Standard │
│Field    │ │Retry    │ │Error    │
└────┬────┘ └─────────┘ └─────────┘
     │
     ▼
┌─────────┴─────────┐
│ Which field?      │
└─────────┬─────────┘
          │
    ┌─────┼─────┐
    │     │     │
    ▼     ▼     ▼
┌────────┐┌────────┐┌────────┐
│Merchant││Amount  ││Other   │
│Unknown ││Zero    ││Invalid │
└───┬────┘└───┬────┘└────────┘
    │         │
    ▼         ▼
┌────────┐┌────────┐
│Request ││Request │
│Merchant││Amount  │
└────────┘└────────┘
```

---

## Key Components

### 1. WorkflowStateManager
- Stores pending workflows in memory
- Maps userId → PendingWorkflow
- Auto-cleanup every 30 minutes
- Thread-safe for concurrent users

### 2. Text Message Handler
- Checks for pending workflow
- Routes to appropriate handler
- Validates user input
- Clears workflow on success

### 3. Error Recovery Methods
- `requestMerchantCorrection()`
- `requestAmountCorrection()`
- `requestRetryWithGuidance()`

### 4. Input Handlers
- `handleMerchantCorrection()`
- `handleAmountCorrection()`
- `handleRetryExtraction()`

---

## Testing Checklist

- [ ] Unknown merchant correction works
- [ ] Amount correction works
- [ ] Full extraction failure → manual entry works
- [ ] /cancel command clears pending workflow
- [ ] Invalid input is rejected gracefully
- [ ] Multiple users can correct simultaneously
- [ ] Workflow auto-cleanup works (after 1 hour)
- [ ] Reasoning is included in categorization
- [ ] Corrected data is stored correctly
- [ ] Confirmation shows corrected values
