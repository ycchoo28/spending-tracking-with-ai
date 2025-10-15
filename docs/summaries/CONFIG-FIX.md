# Configuration Fix - Model Environment Variables

## Issue

The vision processor and categorizer were not using the models specified in the `.env` file. The application was falling back to default models instead of using the configured ones.

## Root Cause

**Mismatch between environment variable names:**

- `.env` file used: `OPENAI_VISION_MODEL` and `OPENAI_TEXT_MODEL`
- Config file expected: `VISION_MODEL` and `CATEGORIZER_MODEL`

This mismatch caused the config to use default values instead of reading from the environment.

## Solution

Updated `src/core/config/index.ts` to support both variable naming conventions:

```typescript
// Before
visionModel: process.env.VISION_MODEL || 'gpt-4-vision-preview',
categorizerModel: process.env.CATEGORIZER_MODEL || 'gpt-4-turbo-preview',

// After
visionModel: process.env.OPENAI_VISION_MODEL || process.env.VISION_MODEL || 'gpt-4-vision-preview',
categorizerModel: process.env.OPENAI_TEXT_MODEL || process.env.CATEGORIZER_MODEL || 'gpt-4-turbo-preview',
```

This change:
1. **Primary:** Reads from `OPENAI_VISION_MODEL` and `OPENAI_TEXT_MODEL` (matches .env)
2. **Fallback:** Reads from `VISION_MODEL` and `CATEGORIZER_MODEL` (legacy support)
3. **Default:** Uses OpenAI defaults if neither is set

## Verification

Created `test-config.ts` to verify configuration loading:

```bash
npx ts-node test-config.ts
```

**Output:**
```
✅ Configuration validation passed

💡 Models being used:
   Vision: Qwen/Qwen3-VL-235B-A22B-Instruct
   Categorizer: ZhipuAI/GLM-4.6
```

## Environment Variables

### Recommended (Current)
```bash
OPENAI_VISION_MODEL=Qwen/Qwen3-VL-235B-A22B-Instruct
OPENAI_TEXT_MODEL=ZhipuAI/GLM-4.6
```

### Legacy (Still Supported)
```bash
VISION_MODEL=gpt-4-vision-preview
CATEGORIZER_MODEL=gpt-4-turbo-preview
```

## Files Modified

1. **src/core/config/index.ts** - Updated to read from both variable names
2. **.env.example** - Added comments explaining variable names
3. **test-config.ts** - Created test script to verify configuration

## Testing

### Manual Test
```bash
# Run the config test
npx ts-node test-config.ts

# Should show your configured models
```

### Integration Test
```bash
# Build the project
npm run build

# Start the application
npm start

# Check logs for model initialization
# Should see: "Vision processor initialized { model: 'Qwen/Qwen3-VL-235B-A22B-Instruct' }"
```

## Impact

- ✅ Vision processor now uses correct model from .env
- ✅ Categorizer now uses correct model from .env
- ✅ Backward compatible with legacy variable names
- ✅ No breaking changes for existing deployments

## Recommendations

1. **Use the recommended variable names** in new deployments:
   - `OPENAI_VISION_MODEL`
   - `OPENAI_TEXT_MODEL`

2. **Update existing deployments** to use the new names (optional, legacy names still work)

3. **Verify configuration** after deployment using `test-config.ts`

## Related Files

- Configuration: `src/core/config/index.ts`
- Example: `.env.example`
- Test: `test-config.ts`
- Documentation: `docs/guides/project-structure.md`

---

**Fixed:** October 15, 2025  
**Status:** ✅ Resolved  
**Impact:** Low (backward compatible)
