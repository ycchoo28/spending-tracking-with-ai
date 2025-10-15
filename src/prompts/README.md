# Prompts

This directory contains all LLM prompts used in the Receipt Tracker Agent.

## Structure

```
prompts/
├── receipt/           # Receipt-specific prompts
│   ├── extraction.ts  # Vision extraction prompt
│   ├── categorization.ts  # Transaction categorization prompt
│   └── suggestion.ts  # Category suggestion prompt
├── shared/            # Shared prompt utilities
│   ├── templates.ts   # Common prompt patterns
│   └── formatters.ts  # Formatting helpers
└── index.ts           # Central exports
```

## Why Centralized Prompts?

1. **Easy to Find** - All prompts in one place
2. **Easy to Update** - Change prompts without touching business logic
3. **Version Control** - Track prompt changes over time
4. **A/B Testing** - Easy to test different prompt variations
5. **Collaboration** - Non-developers can improve prompts
6. **Reusability** - Share common patterns across features

## Usage

Import prompts from the centralized location:

```typescript
import { buildExtractionPrompt } from '../../../prompts/receipt/extraction';

// Use in your code
const prompt = buildExtractionPrompt();
const response = await llm.invoke(prompt);
```

## Adding New Prompts

1. Create a new file in the appropriate subdirectory
2. Export a function that builds the prompt
3. Add JSDoc documentation
4. Export from `index.ts`

Example:

```typescript
/**
 * Builds a prompt for [purpose]
 * @param data - Input data for the prompt
 * @returns Formatted prompt string
 */
export function buildMyPrompt(data: MyData): string {
  return `You are an expert at...
  
  ${data.field}
  
  Please provide...`;
}
```

## Best Practices

1. **Use Functions** - Build prompts dynamically with parameters
2. **Document Parameters** - Clear JSDoc for all inputs
3. **Include Examples** - Show expected output format in prompts
4. **Be Specific** - Clear instructions for the LLM
5. **Test Variations** - Try different phrasings to improve results
6. **Version Control** - Commit prompt changes with clear messages

## Prompt Engineering Tips

1. **System Role** - Start with "You are an expert at..."
2. **Clear Instructions** - Break down the task step-by-step
3. **Output Format** - Specify exact JSON structure expected
4. **Edge Cases** - Handle missing or ambiguous data
5. **Confidence Scoring** - Ask for confidence levels
6. **Examples** - Provide few-shot examples when helpful

## Testing Prompts

Test prompts independently:

```typescript
import { buildExtractionPrompt } from './extraction';

describe('Extraction Prompt', () => {
  it('should include all required fields', () => {
    const prompt = buildExtractionPrompt();
    expect(prompt).toContain('amount');
    expect(prompt).toContain('merchantName');
    // ...
  });
});
```
