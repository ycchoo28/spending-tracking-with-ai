# Project Restructuring Tasks - Option 1B

## Overview
Refactor the receipt tracker agent to separate prompts, business logic, and workflow orchestration using a feature-based structure with centralized prompt management.

## Target Structure
```
src/
├── features/
│   ├── receipt-processing/
│   │   ├── categorizer/
│   │   │   ├── categorizer.ts          # Business logic only
│   │   │   └── index.ts
│   │   ├── vision/
│   │   │   ├── vision-processor.ts     # Business logic only
│   │   │   └── index.ts
│   │   └── workflow/
│   │       ├── nodes/                  # Workflow node implementations
│   │       │   ├── receive-image.ts
│   │       │   ├── extract-data.ts
│   │       │   ├── categorize.ts
│   │       │   ├── request-clarification.ts
│   │       │   ├── store-transaction.ts
│   │       │   └── send-confirmation.ts
│   │       ├── graph.ts                # Graph definition
│   │       ├── orchestrator.ts         # Execution engine
│   │       ├── error-handler.ts
│   │       └── index.ts
│   └── telegram-bot/
│       ├── telegram-bot.ts
│       └── index.ts
├── prompts/                            # All prompts centralized
│   ├── receipt/
│   │   ├── extraction.ts               # Vision extraction prompt
│   │   ├── categorization.ts           # Categorization prompt
│   │   └── suggestion.ts               # Category suggestion prompt
│   ├── shared/
│   │   ├── templates.ts                # Shared prompt templates
│   │   └── formatters.ts               # Prompt formatting utilities
│   └── index.ts                        # Export all prompts
├── core/
│   ├── config/
│   │   └── index.ts
│   ├── database/
│   │   ├── database.ts
│   │   └── index.ts
│   └── utils/
│       ├── logger.ts
│       └── index.ts
└── index.ts

tests/
├── unit/
│   ├── categorizer/
│   ├── vision/
│   ├── workflow/
│   └── prompts/
├── integration/
│   └── workflow/
└── e2e/
    └── telegram-bot/

docs/
├── guides/
│   ├── debugging.md
│   ├── deployment.md
│   ├── langsmith.md
│   ├── logging.md
│   └── error-logging.md
├── architecture/
│   └── workflow-architecture.md
└── quick-start.md
```

---

## Phase 1: Create New Directory Structure

### Task 1.1: Create Core Directories
- [ ] Create `src/features/` directory
- [ ] Create `src/features/receipt-processing/` directory
- [ ] Create `src/prompts/` directory
- [ ] Create `src/core/` directory
- [ ] Create `tests/unit/`, `tests/integration/`, `tests/e2e/` directories
- [ ] Create `docs/guides/` and `docs/architecture/` directories

### Task 1.2: Create Feature Subdirectories
- [ ] Create `src/features/receipt-processing/categorizer/`
- [ ] Create `src/features/receipt-processing/vision/`
- [ ] Create `src/features/receipt-processing/workflow/`
- [ ] Create `src/features/receipt-processing/workflow/nodes/`
- [ ] Create `src/features/telegram-bot/`

### Task 1.3: Create Prompt Directories
- [ ] Create `src/prompts/receipt/`
- [ ] Create `src/prompts/shared/`

### Task 1.4: Create Core Subdirectories
- [ ] Create `src/core/config/`
- [ ] Create `src/core/database/`
- [ ] Create `src/core/utils/`

---

## Phase 2: Extract and Centralize Prompts

### Task 2.1: Extract Vision Prompts
- [ ] Create `src/prompts/receipt/extraction.ts`
- [ ] Move `buildVisionPrompt()` from `src/vision/vision-processor.ts` to extraction prompt
- [ ] Export prompt builder function with clear interface
- [ ] Add JSDoc documentation for prompt parameters

**File: `src/prompts/receipt/extraction.ts`**
```typescript
/**
 * Builds the vision extraction prompt for receipt/e-wallet screenshots
 */
export function buildExtractionPrompt(): string {
  // Move buildVisionPrompt() content here
}
```

### Task 2.2: Extract Categorization Prompts
- [ ] Create `src/prompts/receipt/categorization.ts`
- [ ] Move `buildCategorizationPrompt()` from `src/categorizer/categorizer.ts`
- [ ] Export prompt builder with transaction and history parameters
- [ ] Add JSDoc documentation

**File: `src/prompts/receipt/categorization.ts`**
```typescript
import { ExtractedTransaction } from '../../features/receipt-processing/vision/vision-processor';
import { Transaction } from '../../core/database/database';

/**
 * Builds the categorization prompt with transaction details and history
 */
export function buildCategorizationPrompt(
  transactionData: ExtractedTransaction,
  history: Transaction[]
): string {
  // Move buildCategorizationPrompt() content here
}
```

### Task 2.3: Extract Category Suggestion Prompt
- [ ] Create `src/prompts/receipt/suggestion.ts`
- [ ] Move category suggestion prompt from `suggestCategories()` method
- [ ] Export prompt builder function
- [ ] Add JSDoc documentation

### Task 2.4: Create Shared Prompt Utilities
- [ ] Create `src/prompts/shared/templates.ts` for common prompt patterns
- [ ] Create `src/prompts/shared/formatters.ts` for formatting helpers
- [ ] Add utility functions for JSON response formatting instructions

### Task 2.5: Create Prompt Index
- [ ] Create `src/prompts/index.ts`
- [ ] Export all prompt builders from single entry point

---

## Phase 3: Refactor Business Logic (Remove Prompts)

### Task 3.1: Refactor Vision Processor
- [ ] Move `src/vision/vision-processor.ts` to `src/features/receipt-processing/vision/`
- [ ] Remove `buildVisionPrompt()` method
- [ ] Import prompt from `src/prompts/receipt/extraction`
- [ ] Update method to use imported prompt builder
- [ ] Update `src/vision/index.ts` and move to new location
- [ ] Update all imports in the file

### Task 3.2: Refactor Categorizer
- [ ] Move `src/categorizer/categorizer.ts` to `src/features/receipt-processing/categorizer/`
- [ ] Remove `buildCategorizationPrompt()` method
- [ ] Import prompts from `src/prompts/receipt/`
- [ ] Update methods to use imported prompt builders
- [ ] Move `src/categorizer/README.md` to new location
- [ ] Update all imports in the file

---

## Phase 4: Reorganize Workflow

### Task 4.1: Split Workflow into Nodes
- [ ] Create `src/features/receipt-processing/workflow/nodes/receive-image.ts`
  - Move `receiveImageNode()` function
- [ ] Create `src/features/receipt-processing/workflow/nodes/extract-data.ts`
  - Move `extractDataNode()` function
  - Move `validateExtractedData()` helper
  - Move `isRetryableError()` helper
- [ ] Create `src/features/receipt-processing/workflow/nodes/categorize.ts`
  - Move `categorizeNode()` function
- [ ] Create `src/features/receipt-processing/workflow/nodes/request-clarification.ts`
  - Move `requestClarificationNode()` function
- [ ] Create `src/features/receipt-processing/workflow/nodes/store-transaction.ts`
  - Move `storeTransactionNode()` function
- [ ] Create `src/features/receipt-processing/workflow/nodes/send-confirmation.ts`
  - Move `sendConfirmationNode()` function
  - Move `formatConfirmationMessage()` helper
- [ ] Create `src/features/receipt-processing/workflow/nodes/index.ts` to export all nodes

### Task 4.2: Move Workflow State and Types
- [ ] Create `src/features/receipt-processing/workflow/types.ts`
- [ ] Move `WorkflowState` interface
- [ ] Move `WorkflowDependencies` interface
- [ ] Export from workflow index

### Task 4.3: Reorganize Graph and Orchestrator
- [ ] Move `src/workflow/graph.ts` to `src/features/receipt-processing/workflow/`
- [ ] Update imports to use new node locations
- [ ] Move `src/workflow/error-handler.ts` to `src/features/receipt-processing/workflow/`
- [ ] Move `src/workflow/README.md` to `src/features/receipt-processing/workflow/`
- [ ] Create `src/features/receipt-processing/workflow/index.ts` to export workflow API

---

## Phase 5: Reorganize Core Infrastructure

### Task 5.1: Move Database
- [ ] Move `src/database/database.ts` to `src/core/database/`
- [ ] Create `src/core/database/index.ts`
- [ ] Update all imports across the codebase

### Task 5.2: Move Utils
- [ ] Move `src/utils/logger.ts` to `src/core/utils/`
- [ ] Create `src/core/utils/index.ts`
- [ ] Update all imports across the codebase

### Task 5.3: Create Config Module
- [ ] Create `src/core/config/index.ts`
- [ ] Extract configuration logic from main files if needed
- [ ] Export config utilities

---

## Phase 6: Reorganize Telegram Bot

### Task 6.1: Move Telegram Bot
- [ ] Move `src/telegram/telegram-bot.ts` to `src/features/telegram-bot/`
- [ ] Move `src/telegram/README.md` to `src/features/telegram-bot/`
- [ ] Create `src/features/telegram-bot/index.ts`
- [ ] Update imports to use new workflow location

---

## Phase 7: Update Main Entry Point

### Task 7.1: Update src/index.ts
- [ ] Update all imports to use new structure
- [ ] Verify all exports are accessible
- [ ] Test that application starts correctly

---

## Phase 8: Reorganize Tests

### Task 8.1: Move Unit Tests
- [ ] Move `test-categorizer.ts` to `tests/unit/categorizer/`
- [ ] Move `test-vision-processor.ts` to `tests/unit/vision/`
- [ ] Move `test-workflow.ts` to `tests/unit/workflow/`
- [ ] Create `tests/unit/prompts/` for prompt tests
- [ ] Update all imports in test files

### Task 8.2: Move Integration Tests
- [ ] Move `test-telegram-bot.ts` to `tests/integration/telegram-bot/`
- [ ] Update imports

### Task 8.3: Move E2E Tests
- [ ] Move `test-e2e.ts` to `tests/e2e/`
- [ ] Move `test-scenarios.ts` to `tests/e2e/`
- [ ] Move `run-e2e-tests.sh` to `tests/e2e/`
- [ ] Update imports and paths

---

## Phase 9: Reorganize Documentation

### Task 9.1: Move Guides
- [ ] Move `DEBUGGING-COMPLETE-GUIDE.md` to `docs/guides/debugging.md`
- [ ] Move `DEPLOYMENT.md` to `docs/guides/deployment.md`
- [ ] Move `LANGSMITH-GUIDE.md` to `docs/guides/langsmith.md`
- [ ] Move `LANGSMITH-SETUP-COMPLETE.md` to `docs/guides/langsmith.md` (merge)
- [ ] Move `LOGGING-ENHANCEMENTS.md` to `docs/guides/logging.md`
- [ ] Move `ERROR-LOGGING-GUIDE.md` to `docs/guides/error-logging.md`
- [ ] Move `E2E-TESTING.md` to `docs/guides/testing.md`
- [ ] Move `QUICK-START.md` to `docs/quick-start.md`

### Task 9.2: Move Architecture Docs
- [ ] Move `WORKFLOW-ARCHITECTURE.md` to `docs/architecture/workflow-architecture.md`

### Task 9.3: Move Summary Docs
- [ ] Move `E2E-TEST-SUMMARY.md` to `docs/summaries/` or archive
- [ ] Move `ENHANCEMENTS-SUMMARY.md` to `docs/summaries/` or archive
- [ ] Move `VALIDATION-CHECKLIST.md` to `docs/summaries/` or archive
- [ ] Move `TESTING-QUICK-START.md` to `docs/guides/testing.md` (merge)

### Task 9.4: Update README
- [ ] Update `README.md` with new project structure
- [ ] Update file paths in documentation
- [ ] Add links to docs/ folder

---

## Phase 10: Cleanup and Verification

### Task 10.1: Remove Old Directories
- [ ] Delete `src/vision/` (after verifying move)
- [ ] Delete `src/categorizer/` (after verifying move)
- [ ] Delete `src/workflow/` (after verifying move)
- [ ] Delete `src/telegram/` (after verifying move)
- [ ] Delete `src/database/` (after verifying move)
- [ ] Delete `src/utils/` (after verifying move)

### Task 10.2: Update Package Scripts
- [ ] Update test scripts in `package.json` to use new paths
- [ ] Update any build scripts if needed
- [ ] Update tsconfig paths if configured

### Task 10.3: Verification
- [ ] Run TypeScript compiler: `npm run build`
- [ ] Run all unit tests: `npm test`
- [ ] Run integration tests
- [ ] Run E2E tests
- [ ] Verify application starts: `npm start`
- [ ] Test basic workflow end-to-end

### Task 10.4: Update Git
- [ ] Commit changes with clear message
- [ ] Update .gitignore if needed
- [ ] Tag release if appropriate

---

## Phase 11: Documentation Updates

### Task 11.1: Update Code Documentation
- [ ] Add README.md to each feature directory explaining its purpose
- [ ] Add README.md to prompts/ explaining prompt management
- [ ] Update inline comments to reflect new structure

### Task 11.2: Update Developer Guides
- [ ] Create `docs/guides/project-structure.md` explaining the new organization
- [ ] Update contribution guidelines if they exist
- [ ] Document prompt management workflow

---

## Success Criteria

- [ ] All TypeScript compilation errors resolved
- [ ] All tests passing
- [ ] Application runs successfully
- [ ] No broken imports
- [ ] Documentation updated and accurate
- [ ] Old directories removed
- [ ] Clear separation: prompts / business logic / orchestration
- [ ] Easy to locate and modify prompts
- [ ] Easy to add new workflow nodes
- [ ] Easy to test components in isolation

---

## Rollback Plan

If issues arise during refactoring:
1. Keep old structure in a separate branch before starting
2. Commit after each phase completion
3. Can revert to any phase if needed
4. Test thoroughly after each phase

---

## Estimated Effort

- **Phase 1-2**: 1 hour (structure + prompts)
- **Phase 3-4**: 2 hours (refactor business logic + workflow)
- **Phase 5-7**: 1 hour (core + telegram + entry point)
- **Phase 8-9**: 1 hour (tests + docs)
- **Phase 10-11**: 1 hour (cleanup + verification)

**Total: ~6 hours** (can be done incrementally)

---

## Notes

- Work incrementally - complete one phase before moving to next
- Run tests after each phase to catch issues early
- Keep the application runnable after each phase if possible
- Update imports immediately after moving files
- Use IDE refactoring tools where possible (rename/move)
