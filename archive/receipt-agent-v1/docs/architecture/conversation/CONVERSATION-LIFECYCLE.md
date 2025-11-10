# Conversation Lifecycle Management

## How It Decides to Reuse vs Create New Conversations

### Decision Flow (orchestrator.ts)

```typescript
private async getOrCreateConversation(userId: string, chatId: number): Promise<string> {
  // 1. Check for existing ACTIVE conversations
  const activeConversations = await conversationManager.getActiveConversations(userId);

  if (activeConversations.length > 0) {
    // 2. REUSE: Return the most recent active conversation
    return activeConversations[0].id;
  }

  // 3. CREATE: No active conversations found, create new one
  const conversationId = `conv_${userId}_${Date.now()}`;
  await conversationManager.createConversation(conversationId, userId, chatId);
  return conversationId;
}
```

### Key Decision Criteria

**REUSE existing conversation when:**
- User has at least one conversation with `status = 'active'`
- Returns the most recent one (ordered by `last_activity_at DESC`)

**CREATE new conversation when:**
- User has NO active conversations
- All previous conversations are `completed`, `expired`, or `cancelled`

---

## Conversation Status Lifecycle

```
┌─────────┐
│ active  │ ← Created when user starts new conversation
└────┬────┘
     │
     ├─→ [User sends messages] → stays 'active'
     │
     ├─→ [Agent completes task] → 'completed'
     │
     ├─→ [24 hours of inactivity] → 'expired'
     │
     └─→ [User cancels] → 'cancelled'
```

### Status Transitions

#### 1. **active** → **completed**
**When:** Agent finishes processing and has no more questions
```typescript
// In orchestrator.ts after agent execution
if (!result.shouldContinue && !result.activeSubAgent) {
  await conversationManager.updateStatus(conversationId, 'completed');
}
```

**Triggers:**
- Transaction successfully stored
- No active sub-agent
- `shouldContinue = false`

**Effect:** Next message creates a NEW conversation

---

#### 2. **active** → **expired**
**When:** Conversation inactive for 24 hours (configurable)
```typescript
// In conversation-manager.ts
async expireInactiveConversations(): Promise<number> {
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() - this.expirationHours); // Default: 24

  await supabase
    .from("conversations")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("last_activity_at", expirationTime.toISOString());
}
```

**Triggers:**
- Automatic cleanup job (runs every 6 hours)
- `last_activity_at` older than 24 hours

**Effect:** Next message creates a NEW conversation

---

#### 3. **active** → **cancelled**
**When:** User explicitly cancels (not yet implemented in orchestrator)
```typescript
// Future implementation
await conversationManager.updateStatus(conversationId, 'cancelled');
```

**Triggers:**
- User sends `/cancel` command
- User explicitly requests to start over

**Effect:** Next message creates a NEW conversation

---

## How Conversations Get Cleared

### 1. Status Change (Soft Delete)
Conversations are marked as non-active but kept in database:

```typescript
// Completed
status: 'active' → 'completed'

// Expired
status: 'active' → 'expired'

// Cancelled
status: 'active' → 'cancelled'
```

**Result:** Conversation still exists in DB but won't be reused

---

### 2. Automatic Cleanup Job (Hard Delete)
Runs every 6 hours to delete old data:

```typescript
// In index.ts
conversationManager.startCleanupJob(6); // Every 6 hours

// What it does:
1. Expire conversations inactive > 24 hours
2. Delete checkpoints older than 24 hours
```

**Cleanup Process:**
```typescript
async cleanupExpiredCheckpoints(): Promise<number> {
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() - 24);

  // DELETE old checkpoints from database
  await supabase
    .from("checkpoints")
    .delete()
    .lt("created_at", expirationTime.toISOString());
}
```

---

## Activity Tracking

Every message updates conversation activity:

```typescript
// In orchestrator.ts
await conversationManager.updateActivity(conversationId);
await conversationManager.incrementTurnCount(conversationId);
```

**Updates:**
- `last_activity_at` → current timestamp
- `turn_count` → increments by 1

**Purpose:** Prevents active conversations from expiring

---

## Example Scenarios

### Scenario 1: Multi-Turn Clarification
```
User: [sends receipt]
→ Creates conv_user123_1730000000000 (status: active)

Agent: "What's the merchant name?"
→ Updates last_activity_at, turn_count = 1

User: "Coffee Bean"
→ REUSES conv_user123_1730000000000 (same ID!)
→ Updates last_activity_at, turn_count = 2

Agent: "Transaction saved!"
→ Status changes to 'completed'

User: [sends another receipt]
→ Creates NEW conv_user123_1730000005000
```

---

### Scenario 2: Conversation Expiration
```
User: [sends receipt]
→ Creates conv_user123_1730000000000 (status: active)

Agent: "What's the merchant name?"
→ last_activity_at = 2024-11-05 10:00:00

[User doesn't respond for 25 hours]

Cleanup Job runs:
→ Finds conversation with last_activity_at > 24 hours ago
→ Changes status to 'expired'

User: "Coffee Bean" (25 hours later)
→ No active conversations found
→ Creates NEW conv_user123_1730090000000
→ Agent: "I don't have context. Please send receipt again."
```

---

### Scenario 3: Multiple Active Conversations (Edge Case)
```
User: [sends receipt 1]
→ Creates conv_user123_1730000000000 (status: active)

[System bug: conversation not marked completed]

User: [sends receipt 2]
→ REUSES conv_user123_1730000000000 (most recent active)
→ Continues previous conversation (might be confusing!)
```

**Current Behavior:** Always reuses most recent active conversation
**Potential Issue:** If conversation doesn't complete properly, context bleeds into next interaction

---

## Configuration

### Expiration Time
```typescript
// In index.ts
const conversationManager = new ConversationManager(24); // 24 hours
```

### Cleanup Interval
```typescript
// In index.ts
conversationManager.startCleanupJob(6); // Every 6 hours
```

---

## Potential Issues & Improvements

### Issue 1: No Manual "Start New Conversation"
**Problem:** User can't force a new conversation if agent is stuck
**Solution:** Add `/new` or `/reset` command to mark current conversation as cancelled

### Issue 2: Single Active Conversation Per User
**Problem:** User can't have multiple parallel conversations (e.g., different receipts)
**Solution:** Track conversation context (e.g., by receipt image hash) or allow multiple active conversations

### Issue 3: Conversation Doesn't Complete
**Problem:** If agent fails to set `shouldContinue = false`, conversation stays active forever
**Solution:** Add timeout or max turn count to auto-complete conversations

### Issue 4: No User Feedback on Expiration
**Problem:** User doesn't know their conversation expired
**Solution:** Detect expired conversation and inform user: "Your previous conversation expired. Please start over."

---

## Summary

**Reuse Decision:**
- ✅ Has active conversation → REUSE
- ❌ No active conversation → CREATE NEW

**Clearing Methods:**
1. **Soft:** Status change (completed/expired/cancelled)
2. **Hard:** Cleanup job deletes old checkpoints

**Activity Tracking:**
- Every message updates `last_activity_at`
- Prevents expiration of active conversations

**Default Timings:**
- Expiration: 24 hours of inactivity
- Cleanup: Every 6 hours
