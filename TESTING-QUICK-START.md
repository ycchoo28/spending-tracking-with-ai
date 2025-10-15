# E2E Testing Quick Start

Quick guide to run end-to-end tests for the Receipt Tracker Agent.

## Prerequisites

1. **Environment configured** (`.env` file with all credentials)
2. **Dependencies installed** (`npm install`)
3. **Database set up** (`npm run setup-db`)

## Run Tests

### Quick Run
```bash
npm run test:e2e
```

### With Shell Script
```bash
./run-e2e-tests.sh
```

### Direct Execution
```bash
npx ts-node test-e2e.ts
```

## What Gets Tested

✅ **E-wallet Screenshots** - DuitNow, GrabPay, Touch 'n Go  
✅ **Physical Receipts** - Restaurant, retail, service receipts  
✅ **Edge Cases** - Blurry images, partial receipts, foreign currency  
✅ **Stats Accuracy** - /stats command calculations  
✅ **Concurrent Users** - Multiple users simultaneously  
✅ **Complete Workflow** - End-to-end integration  

## Test Images (Optional)

Add test images to `test-images/` directory:
- `duitnow-sample.jpg`
- `grabpay-sample.jpg`
- `tng-sample.jpg`
- `restaurant-receipt.jpg`
- `retail-receipt.jpg`
- `blurry-receipt.jpg`

**Note**: Tests work without images using mock data.

## Expected Duration

⏱️ **45-60 seconds** for complete test suite

## Output

- ✓ **Green** = Test passed
- ⚠ **Yellow** = Warning (non-critical)
- ✗ **Red** = Test failed

## Troubleshooting

**Missing .env file**
```bash
cp .env.example .env
# Edit .env with your credentials
```

**Database not set up**
```bash
npm run setup-db
```

**Dependencies missing**
```bash
npm install
```

## More Information

See [E2E-TESTING.md](./E2E-TESTING.md) for detailed documentation.
