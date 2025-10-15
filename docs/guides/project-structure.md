# Project Structure Guide

This document explains the organization of the Receipt Tracker Agent codebase.

## Overview

The project follows a **feature-based architecture** with clear separation of concerns:
- **Prompts** are centralized for easy management and versioning
- **Business logic** is separated from orchestration
- **Features** are self-contained modules
- **Core infrastructure** is shared across features

## Directory Structure

```
src/
├── features/                    # Feature modules
│   ├── receipt-processing/      # Receipt processing feature
│   │   ├── categorizer/         # Transaction categorization logic
│   │   ├── vision/              # Image processing and OCR
│   │   └── workflow/            # LangGraph workflow orchestration
│   │       ├── nodes/           # Individual workflow nodes
│   │       ├── graph.ts         # Workflow graph definition
│   │       ├── types.ts         # Workflow types
│   │       └── error-handler.ts # Error handling
│   └── telegram-bot/            # Telegram bot integration
├── prompts/                     # Centralized LLM prompts
│   ├── receipt/                 # Receipt-specific prompts
│   │   ├── extraction.ts        # Vision extraction prompt
│   │   ├── categorization.ts   # Categorization prompt
│   │   └── suggestion.ts        # Category suggestion prompt
│   └── shared/                  # Shared prompt utilities
│       ├── templates.ts         # Common prompt patterns
│       └── formatters.ts        # Formatting helpers
├── core/                        # Core infrastructure
│   ├── config/                  # Configuration management
│   ├── database/                # Database client
│   └── utils/                   # Shared utilities (logger, etc.)
└── index.ts                     # Main entry point

tests/
├── unit/                        # Unit tests
│   ├── categorizer/
│   ├── vision/
│   ├── workflow/
│   └── prompts/
├── integration/                 # Integration tests
│   └── telegram-bot/
└── e2e/                         # End-to-end tests

docs/
├── guides/                      # User guides
│   ├── debugging.md
│   ├── deployment.md
│   ├── langsmith.md
│   ├── logging.md
│   ├── error-logging.md
│   └── testing.md
├── architecture/                # Architecture documentation
│   └── workflow-architecture.md
├── summaries/                   # Project summaries
└── quick-start.md              # Quick start guide
```

## Key Principles

### 1. Feature-Based Organization

Each feature is self-contained with its own:
- Business logic
- Types and interfaces
- Tests
- Documentation

**Example:** `features/receipt-processing/` contains everything related to processing receipts.

### 2. Centralized Prompts

All LLM prompts are in `src/prompts/`:
- Easy to find and update
- Version control friendly
- Can be tested independently
- Non-technical team members can improve prompts

**Example:** Vision extraction prompt is in `prompts/receipt/extraction.ts`, not embedded in the vision processor.

### 3. Separation of Concerns

Clear boundaries between:
- **What to say** (prompts)
- **What to do** (business logic)
- **How to orchestrate** (workflow)

**Example:**
- `prompts/receipt/categorization.ts` - The prompt
- `features/receipt-processing/categorizer/categorizer.ts` - The logic
- `features/receipt-processing/workflow/nodes/categorize.ts` - The orchestration

### 4. Shared Core Infrastructure

Common infrastructure in `src/core/`:
- Configuration
- Database access
- Logging
- Utilities

## Adding New Features

To add a new feature:

1. Create a new directory in `src/features/`
2. Add business logic files
3. Create prompts in `src/prompts/` if needed
4. Add workflow nodes if using LangGraph
5. Export from feature's `index.ts`
6. Add tests in `tests/unit/` and `tests/integration/`

## Modifying Prompts

To modify prompts:

1. Navigate to `src/prompts/`
2. Find the relevant prompt file
3. Update the prompt text
4. Test the changes
5. No code changes needed in business logic!

## Testing

Tests mirror the source structure:
- `tests/unit/` - Unit tests for individual modules
- `tests/integration/` - Integration tests for feature interactions
- `tests/e2e/` - End-to-end tests for full workflows

## Benefits of This Structure

1. **Easy Navigation** - Clear where to find things
2. **Scalable** - Easy to add new features
3. **Maintainable** - Changes are localized
4. **Testable** - Each component can be tested independently
5. **Collaborative** - Non-developers can improve prompts
6. **Flexible** - Easy to swap implementations

## Migration Notes

This structure was created by refactoring from a flat structure. See `docs/summaries/REFACTORING-TASKS.md` for details on the migration process.
