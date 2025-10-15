# Quick Reference - New Project Structure

## 📁 Where to Find Things

### Features
```
src/features/receipt-processing/  - Receipt processing feature
src/features/telegram-bot/         - Telegram bot integration
```

### Prompts (LLM)
```
src/prompts/receipt/               - Receipt-specific prompts
src/prompts/shared/                - Shared prompt utilities
```

### Core Infrastructure
```
src/core/config/                   - Configuration
src/core/database/                 - Database client
src/core/utils/                    - Logger & utilities
```

### Tests
```
tests/unit/                        - Unit tests
tests/integration/                 - Integration tests
tests/e2e/                         - End-to-end tests
```

### Documentation
```
docs/guides/                       - User guides
docs/architecture/                 - Architecture docs
docs/summaries/                    - Project summaries
```

---

## 🔧 Common Tasks

### Adding a New Prompt
1. Create file in `src/prompts/receipt/` or `src/prompts/shared/`
2. Export function that builds the prompt
3. Add to `src/prompts/index.ts`
4. Import and use in your feature

```typescript
// src/prompts/receipt/my-prompt.ts
export function buildMyPrompt(data: MyData): string {
  return `You are an expert at...`;
}

// src/prompts/index.ts
export { buildMyPrompt } from './receipt/my-prompt';

// Usage in feature
import { buildMyPrompt } from '../../../prompts';
const prompt = buildMyPrompt(data);
```

### Adding a New Workflow Node
1. Create file in `src/features/receipt-processing/workflow/nodes/`
2. Implement node function
3. Export from `nodes/index.ts`
4. Add to graph in `graph.ts`

```typescript
// src/features/receipt-processing/workflow/nodes/my-node.ts
import { WorkflowState, WorkflowDependencies } from '../types';

export async function myNode(
  state: WorkflowState,
  deps: WorkflowDependencies
): Promise<Partial<WorkflowState>> {
  // Your logic here
  return { /* updated state */ };
}

// nodes/index.ts
export { myNode } from './my-node';

// graph.ts
workflow.addNode('my_node', async (state) => {
  return await myNode(state, deps);
});
```

### Adding a New Feature
1. Create directory in `src/features/`
2. Add feature files
3. Create `index.ts` to export public API
4. Add prompts to `src/prompts/` if needed
5. Add tests to `tests/unit/` and `tests/integration/`

```
src/features/my-feature/
├── my-feature.ts
├── index.ts
└── README.md
```

### Modifying Configuration
Edit `src/core/config/index.ts`:

```typescript
export const config = {
  // Add your config here
  myFeature: {
    enabled: process.env.MY_FEATURE_ENABLED === 'true',
  },
};
```

---

## 📦 Import Patterns

### Importing from Features
```typescript
// Specific imports
import { VisionProcessor } from './features/receipt-processing/vision';
import { TransactionCategorizer } from './features/receipt-processing/categorizer';

// Feature-level imports
import { 
  VisionProcessor, 
  TransactionCategorizer,
  createWorkflowGraph 
} from './features/receipt-processing';
```

### Importing Prompts
```typescript
// Specific prompt
import { buildExtractionPrompt } from './prompts/receipt/extraction';

// Multiple prompts
import { 
  buildExtractionPrompt,
  buildCategorizationPrompt 
} from './prompts';
```

### Importing Core
```typescript
// Configuration
import { config, validateConfig } from './core/config';

// Database
import { DatabaseClient } from './core/database';

// Utilities
import { logger } from './core/utils';
```

---

## 🧪 Testing

### Run Tests
```bash
# All tests
npm test

# Unit tests only
npm test tests/unit

# Specific feature
npm test tests/unit/vision

# E2E tests
npm test tests/e2e
```

### Test File Location
Place tests next to what they test:
- Unit test for `src/features/receipt-processing/vision/` → `tests/unit/vision/`
- Integration test for telegram bot → `tests/integration/telegram-bot/`

---

## 🏗️ Build & Run

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Production
```bash
npm start
```

---

## 📚 Documentation

### Key Documents
- **Project Structure:** `docs/guides/project-structure.md`
- **Prompt Management:** `src/prompts/README.md`
- **Receipt Processing:** `src/features/receipt-processing/README.md`
- **Workflow Architecture:** `docs/architecture/workflow-architecture.md`

### Quick Links
- Main README: `README.md`
- Quick Start: `docs/quick-start.md`
- Deployment: `docs/guides/deployment.md`

---

## 🎯 Best Practices

### 1. Keep Prompts Centralized
❌ Don't embed prompts in business logic  
✅ Create prompt files in `src/prompts/`

### 2. Use Feature Exports
❌ Don't import from deep paths  
✅ Use feature-level exports from `index.ts`

### 3. Separate Concerns
- **Prompts** - What to say
- **Business Logic** - What to do
- **Workflow** - How to orchestrate

### 4. Test Independently
- Unit test each component
- Integration test feature interactions
- E2E test full workflows

### 5. Document Changes
- Update README files
- Add JSDoc comments
- Document breaking changes

---

## 🚨 Common Issues

### Import Errors
**Problem:** Cannot find module  
**Solution:** Check import path matches new structure

### Type Errors
**Problem:** Type not found  
**Solution:** Import types from feature's `index.ts`

### Build Errors
**Problem:** Build fails  
**Solution:** Run `npm run build` to see specific errors

---

## 💡 Tips

1. **Use IDE autocomplete** - Feature exports make this easy
2. **Check README files** - Each feature has documentation
3. **Follow existing patterns** - Look at similar code
4. **Test as you go** - Don't wait until the end
5. **Ask for help** - Check docs or ask the team

---

## 🔗 Quick Links

- [Project Structure Guide](docs/guides/project-structure.md)
- [Refactoring Summary](docs/summaries/REFACTORING-COMPLETE.md)
- [Workflow Architecture](docs/architecture/workflow-architecture.md)
- [Main README](README.md)

---

**Last Updated:** October 15, 2025  
**Version:** 2.0.0 (Post-Refactoring)
